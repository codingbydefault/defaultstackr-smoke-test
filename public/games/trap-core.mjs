// Trap!-style avoidance logic. Pure and deterministic with injected random.

export const GRID = 9;
export const BALLS = 3;

export const MAX_BALLS = 6;
export const ESCALATE_EVERY = 20;
export const SLOW_FACTOR = 0.55;
export const SLOW_DURATION = 5;
export const NEAR_MISS_DISTANCE = 1.25;
export const NEAR_MISS_RESET = 1.9;
export const NEAR_MISS_BONUS = 25;
export const PICKUP_GAP = 7;
export const MAX_PICKUPS = 2;
export const PICKUP_RADIUS = 0.85;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function makeBall(index, random) {
  const axis = Math.floor(random() * 2);
  const edge = random() < 0.5 ? 0 : GRID - 1;
  const along = 1 + Math.floor(random() * (GRID - 2));
  return {
    x: axis === 0 ? edge : along,
    y: axis === 0 ? along : edge,
    vx: (axis === 0 ? (edge === 0 ? 1 : -1) : (random() < 0.5 ? -1 : 1)) * 2.8,
    vy: (axis === 0 ? (random() < 0.5 ? -1 : 1) : (edge === 0 ? 1 : -1)) * 2.8,
    id: index,
    nearMissed: false
  };
}

function makePickup(id, random) {
  return {
    id,
    type: random() < 0.5 ? 'shield' : 'slow',
    x: random() * (GRID - 1),
    y: random() * (GRID - 1),
    vx: (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.25),
    vy: (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.25)
  };
}

function resetBoard(state, random, count) {
  state.player = { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) };
  state.balls = Array.from({ length: count }, (_, i) => makeBall(i, random));
}

export function newTrap(random = Math.random) {
  return {
    player: { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) },
    balls: Array.from({ length: BALLS }, (_, i) => makeBall(i, random)),
    pickups: [],
    pickupId: 0,
    pickupTimer: PICKUP_GAP + random() * PICKUP_GAP,
    shield: 0,
    slowTime: 0,
    level: 0,
    score: 0,
    lives: 3,
    time: 0,
    over: false
  };
}

export function movePlayer(state, direction) {
  if (state.over) return state;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  state.player.x = clamp(state.player.x + dx, 0, GRID - 1);
  state.player.y = clamp(state.player.y + dy, 0, GRID - 1);
  return state;
}

export function stepTrap(state, dt, random = Math.random) {
  const result = { hit: false, lost: false, nearMiss: 0, collected: [], shieldUsed: false };
  if (state.over) return result;

  // Defensive defaults keep hand-built states (and older saves) usable.
  state.pickups ||= [];
  state.pickupId ??= 0;
  state.shield ||= 0;
  state.slowTime ||= 0;
  state.pickupTimer ??= PICKUP_GAP;
  state.level ??= 0;

  state.time += dt;
  state.score += Math.floor(dt * 10);

  // Snapshot slow motion before ticking it down so a pickup collected later
  // in this same step does not retroactively slow this step's movement.
  const slowed = state.slowTime > 0;
  if (slowed) state.slowTime = Math.max(0, state.slowTime - dt);

  // One extra ball every 20 seconds, up to MAX_BALLS, plus a small speed bump.
  const targetBalls = Math.min(MAX_BALLS, BALLS + Math.floor(state.time / ESCALATE_EVERY));
  state.level = targetBalls - BALLS;
  while (state.balls.length < targetBalls) {
    state.balls.push(makeBall(state.balls.length, random));
  }
  const speed = 1 + Math.min(1.6, state.time / 45) + state.level * 0.12;
  const step = dt * speed * (slowed ? SLOW_FACTOR : 1);

  for (const ball of state.balls) {
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    if (ball.x < 0) { ball.x = -ball.x; ball.vx = Math.abs(ball.vx); }
    if (ball.x > GRID - 1) { ball.x = 2 * (GRID - 1) - ball.x; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < 0) { ball.y = -ball.y; ball.vy = Math.abs(ball.vy); }
    if (ball.y > GRID - 1) { ball.y = 2 * (GRID - 1) - ball.y; ball.vy = -Math.abs(ball.vy); }
  }

  // Power-ups drift slowly and bounce off the walls just like the balls.
  for (const pickup of state.pickups) {
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (pickup.x < 0) { pickup.x = -pickup.x; pickup.vx = Math.abs(pickup.vx); }
    if (pickup.x > GRID - 1) { pickup.x = 2 * (GRID - 1) - pickup.x; pickup.vx = -Math.abs(pickup.vx); }
    if (pickup.y < 0) { pickup.y = -pickup.y; pickup.vy = Math.abs(pickup.vy); }
    if (pickup.y > GRID - 1) { pickup.y = 2 * (GRID - 1) - pickup.y; pickup.vy = -Math.abs(pickup.vy); }
  }

  state.pickupTimer -= dt;
  if (state.pickupTimer <= 0) {
    if (state.pickups.length < MAX_PICKUPS) {
      state.pickups.push(makePickup(state.pickupId, random));
      state.pickupId += 1;
    }
    state.pickupTimer = PICKUP_GAP + random() * PICKUP_GAP;
  }

  const remaining = [];
  for (const pickup of state.pickups) {
    if (Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) > PICKUP_RADIUS) {
      remaining.push(pickup);
      continue;
    }
    result.collected.push(pickup.type);
    if (pickup.type === 'shield') {
      if (state.shield < 1) state.shield = 1;
      else state.score += 50;
    } else {
      state.slowTime = SLOW_DURATION;
    }
  }
  state.pickups = remaining;

  const px = state.player.x;
  const py = state.player.y;
  for (const ball of state.balls) {
    const touching = Math.round(ball.x) === px && Math.round(ball.y) === py;
    if (touching) {
      ball.nearMissed = true;
      continue;
    }
    const distance = Math.hypot(ball.x - px, ball.y - py);
    if (distance > NEAR_MISS_RESET) ball.nearMissed = false;
    else if (distance <= NEAR_MISS_DISTANCE && !ball.nearMissed) {
      ball.nearMissed = true;
      result.nearMiss += 1;
      state.score += NEAR_MISS_BONUS;
    }
  }

  const caught = state.balls.some((ball) =>
    Math.round(ball.x) === px && Math.round(ball.y) === py);
  if (caught) {
    result.hit = true;
    if (state.shield > 0) {
      state.shield -= 1;
      result.shieldUsed = true;
      resetBoard(state, random, targetBalls);
    } else {
      state.lives -= 1;
      if (state.lives <= 0) {
        state.lives = 0;
        state.over = true;
        result.lost = true;
      } else {
        resetBoard(state, random, targetBalls);
      }
    }
  }
  return result;
}
