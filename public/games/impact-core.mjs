// Space Impact-style shooter logic. No DOM access, so it can be unit tested.

export const FIELD_W = 34;
export const FIELD_H = 24;

export const TYPES = Object.freeze({
  scout: { w: 3, h: 2, speed: 6, hp: 1, points: 10 },
  heavy: { w: 4, h: 3, speed: 3.5, hp: 2, points: 25 },
  boss: { w: 7, h: 5, speed: 1.6, hp: 12, points: 150 }
});

export const WEAPON_DURATION = 8;
export const PICKUP_CHANCE = 0.28;
export const PICKUP_SPEED = 5;

const PICKUP_TYPES = ['weapon', 'shield', 'repair'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function enemySize(enemy) {
  return TYPES[enemy.type];
}

// Enemies use the shared type table; pickups and bullets carry their own size.
const sizeOf = (entity) => enemySize(entity) || entity;

export function newImpact() {
  return {
    ship: { x: 3, y: Math.floor(FIELD_H / 2) },
    bullets: [],
    enemies: [],
    pickups: [],
    score: 0,
    lives: 3,
    level: 1,
    time: 0,
    spawnIn: 0.7,
    fireIn: 0,
    invuln: 0,
    flash: 0,
    weaponTime: 0,
    shield: 0,
    bossLevel: 0,
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
  if (state.over || state.fireIn > 0) return false;
  const upgraded = state.weaponTime > 0;
  const shots = upgraded ? 3 : 1;
  if (state.bullets.length + shots > (upgraded ? 9 : 6)) return false;
  const x = state.ship.x + 2;
  if (upgraded) {
    state.bullets.push({ x, y: state.ship.y - 1, w: 3, h: 1, vy: -4 });
    state.bullets.push({ x, y: state.ship.y, w: 3, h: 1 });
    state.bullets.push({ x, y: state.ship.y + 1, w: 3, h: 1, vy: 4 });
  } else {
    state.bullets.push({ x, y: state.ship.y, w: 3, h: 1 });
  }
  state.fireIn = upgraded ? 0.08 : 0.16;
  return true;
}

function spawnEnemy(state, random, forcedType) {
  const type = forcedType || (random() < 0.22 ? 'heavy' : 'scout');
  const size = TYPES[type];
  const baseY = 1 + random() * (FIELD_H - size.h - 2);
  state.enemies.push({
    type,
    x: FIELD_W,
    y: baseY,
    baseY,
    wobble: random() * 6,
    freq: 1.2 + random() * 1.4,
    amp: type === 'boss' ? 0.6 : type === 'heavy' ? 0.8 : 1.8,
    hp: size.hp,
    maxHp: size.hp
  });
}

// The injected random drives the drop roll, the pickup kind and its vertical
// offset, so every drop is reproducible in tests.
function dropPickup(state, enemy, random) {
  if (random() >= PICKUP_CHANCE) return;
  const index = Math.min(PICKUP_TYPES.length - 1, Math.floor(random() * PICKUP_TYPES.length));
  const size = sizeOf(enemy);
  const y = clamp(enemy.y + size.h / 2 - 1.5 + (random() - 0.5) * 2, 1, FIELD_H - 3);
  state.pickups.push({ type: PICKUP_TYPES[index], x: enemy.x, y, w: 3, h: 3 });
}

function overlaps(a, b) {
  const size = sizeOf(b);
  return a.x < b.x + size.w && a.x + a.w > b.x && a.y < b.y + size.h && a.y + a.h > b.y;
}

export function stepImpact(state, dt, random = Math.random) {
  const result = { destroyed: 0, hit: false, collected: [], bossDown: false, shielded: false, bossSpawn: false };
  if (state.over) return result;

  state.time += dt;
  state.fireIn = Math.max(0, state.fireIn - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.flash = Math.max(0, state.flash - dt);
  state.weaponTime = Math.max(0, state.weaponTime - dt);

  for (const bullet of state.bullets) {
    bullet.x += 28 * dt;
    if (bullet.vy) bullet.y += bullet.vy * dt;
  }
  state.bullets = state.bullets.filter((bullet) => bullet.x < FIELD_W && bullet.y >= -1 && bullet.y <= FIELD_H);

  for (const pickup of state.pickups) pickup.x -= PICKUP_SPEED * dt;
  state.pickups = state.pickups.filter((pickup) => pickup.x + pickup.w >= 0);

  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawnEnemy(state, random);
    const base = Math.max(0.45, 1.25 - (state.level - 1) * 0.09);
    state.spawnIn = base * (0.75 + random() * 0.5);
  }

  for (const enemy of state.enemies) {
    const size = sizeOf(enemy);
    enemy.x -= (size.speed + (state.level - 1) * 0.6) * dt;
    enemy.wobble += dt;
    enemy.y = clamp(enemy.baseY + Math.sin(enemy.wobble * enemy.freq) * enemy.amp, 1, FIELD_H - size.h - 1);
  }
  state.enemies = state.enemies.filter((enemy) => enemy.x + sizeOf(enemy).w >= 0);

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (!overlaps(bullet, enemy)) continue;
      bullet.dead = true;
      enemy.hp -= 1;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        state.score += sizeOf(enemy).points;
        result.destroyed += 1;
        if (enemy.type === 'boss') result.bossDown = true;
        dropPickup(state, enemy, random);
      }
      break;
    }
  }
  state.bullets = state.bullets.filter((bullet) => !bullet.dead);
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);

  const ship = { x: state.ship.x, y: state.ship.y, w: 2, h: 2 };
  for (const pickup of state.pickups) {
    if (pickup.dead || !overlaps(ship, pickup)) continue;
    pickup.dead = true;
    result.collected.push(pickup.type);
    if (pickup.type === 'weapon') state.weaponTime = WEAPON_DURATION;
    else if (pickup.type === 'shield') state.shield = 1;
    else if (pickup.type === 'repair') state.lives = Math.min(3, state.lives + 1);
  }
  state.pickups = state.pickups.filter((pickup) => !pickup.dead);

  if (state.invuln <= 0) {
    for (const enemy of state.enemies) {
      if (!overlaps(ship, enemy)) continue;
      enemy.dead = true;
      state.invuln = 1.2;
      state.flash = 0.3;
      if (state.shield > 0) {
        state.shield = 0;
        result.shielded = true;
      } else {
        state.lives -= 1;
        result.hit = true;
        if (state.lives <= 0) {
          state.lives = 0;
          state.over = true;
        }
      }
      break;
    }
    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
  }

  state.level = 1 + Math.floor(state.score / 250);
  if (!state.over && state.level % 3 === 0 && state.bossLevel !== state.level) {
    spawnEnemy(state, random, 'boss');
    state.bossLevel = state.level;
    result.bossSpawn = true;
  }
  return result;
}
