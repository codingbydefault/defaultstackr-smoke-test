// Space Impact-style shooter logic. No DOM access, so it can be unit tested.

export const FIELD_W = 34;
export const FIELD_H = 24;

const TYPES = Object.freeze({
  scout: { w: 3, h: 2, speed: 6, hp: 1, points: 10 },
  heavy: { w: 4, h: 3, speed: 3.5, hp: 2, points: 25 }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function enemySize(enemy) {
  return TYPES[enemy.type];
}

export function newImpact() {
  return {
    ship: { x: 3, y: Math.floor(FIELD_H / 2) },
    bullets: [],
    enemies: [],
    score: 0,
    lives: 3,
    level: 1,
    time: 0,
    spawnIn: 0.7,
    fireIn: 0,
    invuln: 0,
    flash: 0,
    over: false
  };
}

export function moveShip(state, direction, dt) {
  if (state.over) return state;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  state.ship.y = clamp(state.ship.y + dy * 16 * dt, 1, FIELD_H - 2);
  return state;
}

export function fireImpact(state) {
  if (state.over || state.fireIn > 0 || state.bullets.length >= 6) return false;
  state.bullets.push({ x: state.ship.x + 2, y: state.ship.y, w: 3, h: 1 });
  state.fireIn = 0.16;
  return true;
}

function spawnEnemy(state, random) {
  const type = random() < 0.22 ? 'heavy' : 'scout';
  const size = TYPES[type];
  const baseY = 1 + random() * (FIELD_H - size.h - 2);
  state.enemies.push({
    type,
    x: FIELD_W,
    y: baseY,
    baseY,
    wobble: random() * 6,
    freq: 1.2 + random() * 1.4,
    amp: type === 'heavy' ? 0.8 : 1.8,
    hp: size.hp
  });
}

function overlaps(a, b) {
  const size = enemySize(b);
  return a.x < b.x + size.w && a.x + a.w > b.x && a.y < b.y + size.h && a.y + a.h > b.y;
}

export function stepImpact(state, dt, random = Math.random) {
  const result = { destroyed: 0, hit: false };
  if (state.over) return result;

  state.time += dt;
  state.fireIn = Math.max(0, state.fireIn - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.flash = Math.max(0, state.flash - dt);

  for (const bullet of state.bullets) bullet.x += 28 * dt;
  state.bullets = state.bullets.filter((bullet) => bullet.x < FIELD_W);

  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawnEnemy(state, random);
    const base = Math.max(0.45, 1.25 - (state.level - 1) * 0.09);
    state.spawnIn = base * (0.75 + random() * 0.5);
  }

  for (const enemy of state.enemies) {
    const size = enemySize(enemy);
    enemy.x -= (size.speed + (state.level - 1) * 0.6) * dt;
    enemy.wobble += dt;
    enemy.y = clamp(enemy.baseY + Math.sin(enemy.wobble * enemy.freq) * enemy.amp, 1, FIELD_H - size.h - 1);
  }
  state.enemies = state.enemies.filter((enemy) => enemy.x + enemySize(enemy).w >= 0);

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (!overlaps(bullet, enemy)) continue;
      bullet.dead = true;
      enemy.hp -= 1;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        state.score += enemySize(enemy).points;
        result.destroyed += 1;
      }
      break;
    }
  }
  state.bullets = state.bullets.filter((bullet) => !bullet.dead);
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);

  if (state.invuln <= 0) {
    for (const enemy of state.enemies) {
      if (!overlaps({ x: state.ship.x, y: state.ship.y, w: 2, h: 2 }, enemy)) continue;
      enemy.dead = true;
      state.lives -= 1;
      state.invuln = 1.2;
      state.flash = 0.3;
      result.hit = true;
      if (state.lives <= 0) {
        state.lives = 0;
        state.over = true;
      }
      break;
    }
    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
  }

  state.level = 1 + Math.floor(state.score / 250);
  return result;
}
