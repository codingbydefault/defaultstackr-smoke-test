// Frogger-style crossing logic. Pure and deterministic with injected random.

export const GRID = 13;
export const HOME_ROW = 0;
export const RIVER_ROWS = 3; // y = 1..3
export const ROAD_ROWS = 4; // y = 4..7
export const START_ROW = GRID - 5; // y = 8..12 is de startzone
export const SPAWN_Y = GRID - 1;
export const LIVES = 3;
export const SCORE_PER_SECOND = 25;
export const NEAR_MISS_DISTANCE = 1.25;
export const NEAR_MISS_RESET = 1.9;
export const NEAR_MISS_BONUS = 25;
export const PICKUP_GAP = 7;
export const MAX_PICKUPS = 2;
export const PICKUP_RADIUS = 0.85;
export const SLOW_FACTOR = 0.55;
export const SLOW_DURATION = 5;
export const CAR_SPEED = 2.2;
export const MAX_CARS = 5;
export const LOG_SPEED = 1.6;
export const MAX_LOGS = 3;
export const LOG_LENGTH = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makeCar(index, random, speed) {
  const edge = random() < 0.5 ? 0 : GRID - 1;
  const along = 1 + Math.floor(random() * (GRID - 2));
  return { id: index, x: edge, y: along, vx: (edge === 0 ? 1 : -1) * speed, missed: false };
}

function makeLog(index, random, speed) {
  const edge = random() < 0.5 ? 0 : GRID - 1;
  const along = 1 + Math.floor(random() * (GRID - 2));
  return { id: index, x: edge, y: along, vx: (random() < 0.5 ? -1 : 1) * speed, len: LOG_LENGTH, missed: false };
}

function resetBoard(state, random, carCount, logCount) {
  state.player = { x: Math.floor(GRID / 2), y: SPAWN_Y };
  state.cars = Array.from({ length: carCount }, (_, i) => makeCar(i, random, state.speed));
  state.logs = Array.from({ length: logCount }, (_, i) => makeLog(i, random, state.logSpeed));
}

export function newFrogger(random = Math.random) {
  const state = {
    player: { x: Math.floor(GRID / 2), y: SPAWN_Y },
    cars: [makeCar(0, random, CAR_SPEED), makeCar(1, random, CAR_SPEED * 0.9), makeCar(2, random, CAR_SPEED * 1.1)],
    logs: [makeLog(0, random, LOG_SPEED), makeLog(1, random, LOG_SPEED * 0.85), makeLog(2, random, LOG_SPEED * 1.15)],
    pickups: [],
    pickupId: 0,
    pickupTimer: PICKUP_GAP + random() * PICKUP_GAP,
    shield: 0,
    slowTime: 0,
    level: 0,
    score: 0,
    lives: LIVES,
    time: 0,
    over: false,
    reachedHome: false
  };
  state.speed = CAR_SPEED;
  state.logSpeed = LOG_SPEED;
  return state;
}

export function movePlayer(state, direction) {
  if (state.over) return state;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  state.player.x = clamp(Math.round(state.player.x) + dx, 0, GRID - 1);
  state.player.y = clamp(Math.round(state.player.y) + dy, 0, GRID - 1);
  return state;
}

function onLog(log, player) {
  const min = Math.floor(log.x - 0.5);
  const max = Math.floor(log.x + log.len - 0.5);
  return player.y > HOME_ROW && player.y <= HOME_ROW + RIVER_ROWS
    && player.x >= min && player.x < max;
}

export function stepFrogger(state, dt, random = Math.random) {
  const result = { hit: false, lost: false, reachedHome: false, collected: [], shieldUsed: false, nearMiss: 0 };
  if (state.over) return result;

  state.pickups ||= [];
  state.pickupId ??= 0;
  state.shield ||= 0;
  state.slowTime ||= 0;
  state.pickupTimer ??= PICKUP_GAP;
  state.level ??= 0;
  state.speed ||= CAR_SPEED;
  state.logSpeed ||= LOG_SPEED;

  state.time += dt;
  state.score += Math.floor(dt * SCORE_PER_SECOND);

  const slowed = state.slowTime > 0;
  if (slowed) state.slowTime = Math.max(0, state.slowTime - dt);

  const targetCars = Math.min(MAX_CARS, 3 + Math.floor(state.time / 15));
  state.level = Math.max(0, targetCars - 3);
  state.speed = CAR_SPEED + state.level * 0.35;
  const targetLogs = Math.min(MAX_LOGS, 3 + Math.floor(state.time / 25));
  state.logSpeed = LOG_SPEED + state.level * 0.2;
  while (state.cars.length < targetCars) state.cars.push(makeCar(state.cars.length, random, state.speed));
  while (state.logs.length < targetLogs) state.logs.push(makeLog(state.logs.length, random, state.logSpeed));

  const step = dt * (slowed ? SLOW_FACTOR : 1);
  for (const car of state.cars) {
    car.x += car.vx * step;
    if (car.x < -1) { car.x = GRID + 1; car.vx = -Math.abs(car.vx); }
    if (car.x > GRID + 1) { car.x = -1; car.vx = Math.abs(car.vx); }
    const distance = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (distance > NEAR_MISS_RESET) car.missed = false;
    else if (distance <= NEAR_MISS_DISTANCE && !car.missed) {
      car.missed = true;
      result.nearMiss += 1;
      state.score += NEAR_MISS_BONUS;
    }
  }
  for (const log of state.logs) {
    log.x += log.vx * step;
    if (log.x < -LOG_LENGTH - 1) { log.x = GRID + 1; log.vx = -Math.abs(log.vx); }
    if (log.x > GRID + 1) { log.x = -1 - LOG_LENGTH; log.vx = Math.abs(log.vx); }
    const distance = Math.hypot(log.x - state.player.x, log.y - state.player.y);
    if (distance > NEAR_MISS_RESET) log.missed = false;
    else if (distance <= NEAR_MISS_DISTANCE && !log.missed) {
      log.missed = true;
      result.nearMiss += 1;
      state.score += NEAR_MISS_BONUS;
    }
  }

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
      state.pickups.push({
        id: state.pickupId,
        type: Math.random() < 0.5 ? 'shield' : 'slow',
        x: Math.random() * (GRID - 1),
        y: Math.random() * (GRID - 1),
        vx: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.25),
        vy: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.25)
      });
      state.pickupId += 1;
    }
    state.pickupTimer = PICKUP_GAP + Math.random() * PICKUP_GAP;
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
  const inRiver = py > HOME_ROW && py <= HOME_ROW + RIVER_ROWS;
  const inRoad = py > HOME_ROW + RIVER_ROWS && py <= HOME_ROW + RIVER_ROWS + ROAD_ROWS;
  const caught = inRoad && state.cars.some((car) => Math.round(car.x) === px && Math.round(car.y) === py);
  const fellIn = inRiver && !state.logs.some((log) => onLog(log, state.player));

  if (caught || fellIn) {
    result.hit = true;
    if (state.shield > 0) {
      state.shield -= 1;
      result.shieldUsed = true;
    } else {
      result.hit = true;
      state.lives -= 1;
      if (state.lives <= 0) {
        state.lives = 0;
        state.over = true;
        result.lost = true;
      } else {
        state.player = { x: Math.floor(GRID / 2), y: SPAWN_Y };
      }
    }
  }

  if (state.player.y <= HOME_ROW && !state.over) {
    state.reachedHome = true;
    state.over = true;
    result.reachedHome = true;
  }
  return result;
}
