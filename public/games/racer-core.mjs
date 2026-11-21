// retro LCD-era top-down racer logic. Pure and deterministic with injected random.
// All state is mutated in place, matching the other game cores in this folder.

export const FIELD_W = 16;
export const FIELD_H = 24;
export const ROAD_LEFT = 2;
export const ROAD_RIGHT = 13;

export const CAR_W = 2;
export const CAR_H = 3;
export const MAX_LIVES = 3;
export const NITRO_MAX = 100;
export const BOOST_COST = 35;
export const BOOST_DURATION = 3;
export const NITRO_PICKUP = 35;
export const SCORE_RATE = 12;
export const BOOST_SCORE_RATE = SCORE_RATE * 2;
export const OVERTAKE_POINTS = 40;
export const INVULN_TIME = 1.2;
export const BASE_SPEED = 7;
export const BOOST_SCROLL_MULT = 1.7;
export const STEER_SPEED = 12;
export const DIFFICULTY_EVERY = 18;
export const MAX_PICKUPS = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sizeOf = (entity) => ({ w: entity.w ?? CAR_W, h: entity.h ?? CAR_H });

function overlaps(a, b) {
  const sa = sizeOf(a);
  const sb = sizeOf(b);
  return a.x < b.x + sb.w && a.x + sa.w > b.x
    && a.y < b.y + sb.h && a.y + sa.h > b.y;
}

// The score is kept as an integer; the fractional remainder is carried between
// steps so short frames still add up to the exact score rate.
export function racerScore(state) {
  return Math.floor(state.score);
}

export function newRacer(random = Math.random) {
  return {
    car: {
      x: Math.floor((ROAD_LEFT + ROAD_RIGHT - CAR_W) / 2),
      y: FIELD_H - 5,
      w: CAR_W,
      h: CAR_H
    },
    traffic: [],
    pickups: [],
    score: 0,
    scoreFrac: 0,
    distance: 0,
    passed: 0,
    hits: 0,
    lives: MAX_LIVES,
    nitro: 0,
    speed: BASE_SPEED,
    time: 0,
    over: false,
    spawnIn: 0.6 + random() * 0.5,
    pickupIn: 4 + random() * 2,
    invuln: 0,
    flash: 0,
    boostTime: 0,
    pendingBoost: false,
    level: 1,
    trafficId: 0,
    pickupId: 0,
    message: 'RACE!',
    messageTimer: 1.5
  };
}

export function steerRacer(state, direction, dt) {
  if (state.over) return state;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  state.car.x = clamp(state.car.x + dx * STEER_SPEED * dt, ROAD_LEFT, ROAD_RIGHT - sizeOf(state.car).w);
  return state;
}

export function boostRacer(state) {
  if (state.over || state.nitro < BOOST_COST) return false;
  state.nitro -= BOOST_COST;
  state.boostTime = BOOST_DURATION;
  state.pendingBoost = true;
  return true;
}

function spawnTraffic(state, random) {
  const lanes = ROAD_RIGHT - ROAD_LEFT - CAR_W + 1;
  state.traffic.push({
    id: state.trafficId++,
    x: ROAD_LEFT + Math.floor(random() * lanes),
    type: random() < 0.35 ? 'truck' : 'car',
    y: -CAR_H,
    w: CAR_W,
    h: CAR_H,
    // Relative to the scrolling road, oncoming traffic always comes at you.
    speed: 4.5 + random() * 3.5,
    tone: Math.floor(random() * 3)
  });
}

function spawnPickup(state, random) {
  const lanes = ROAD_RIGHT - ROAD_LEFT - 2 + 1;
  state.pickups.push({
    id: state.pickupId++,
    x: ROAD_LEFT + Math.floor(random() * lanes),
    y: -2,
    w: 2,
    h: 2
  });
}

// Events: passed = number of cars overtaken, hit = a collision happened this
// step, collected = number of nitro cans picked up, boosted = boost activated.
export function stepRacer(state, dt, random = Math.random) {
  const events = { passed: 0, hit: false, collected: 0, boosted: false };
  if (state.over) return events;

  state.traffic ||= [];
  state.pickups ||= [];

  // Snapshot the boost before ticking it down so the whole step is boosted.
  const boosting = state.boostTime > 0;
  state.time += dt;
  state.boostTime = Math.max(0, state.boostTime - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.flash = Math.max(0, state.flash - dt);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (!state.messageTimer) state.message = '';

  state.level = 1 + Math.min(6, Math.floor(state.time / DIFFICULTY_EVERY));
  state.speed = (BASE_SPEED + (state.level - 1) * 0.7) * (boosting ? BOOST_SCROLL_MULT : 1);

  const gained = (boosting ? BOOST_SCORE_RATE : SCORE_RATE) * dt + (state.scoreFrac || 0);
  state.score += Math.floor(gained);
  state.scoreFrac = gained - Math.floor(gained);
  state.distance += state.speed * dt;

  if (state.pendingBoost) {
    state.pendingBoost = false;
    events.boosted = true;
    state.message = 'BOOST!';
    state.messageTimer = 1.1;
  }

  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawnTraffic(state, random);
    const base = Math.max(0.42, 1.25 - (state.level - 1) * 0.11);
    state.spawnIn = base * (0.8 + random() * 0.4);
  }

  state.pickupIn -= dt;
  if (state.pickupIn <= 0) {
    if (state.pickups.length < MAX_PICKUPS) spawnPickup(state, random);
    state.pickupIn = 6 + random() * 4;
  }

  for (const car of state.traffic) car.y += (state.speed + car.speed) * dt;
  for (const car of state.traffic) {
    if (car.dead || state.invuln > 0 || !overlaps(car, state.car)) continue;
    car.dead = true;
    state.lives -= 1;
    state.hits += 1;
    state.invuln = INVULN_TIME;
    state.flash = 0.35;
    events.hit = true;
    state.message = 'CRASH!';
    state.messageTimer = 1.2;
    if (state.lives <= 0) {
      state.lives = 0;
      state.over = true;
      state.message = 'WRECKED';
    }
  }
  const staying = [];
  for (const car of state.traffic) {
    if (car.dead) continue;
    if (car.y >= FIELD_H) {
      events.passed += 1;
      state.passed += 1;
      state.score += OVERTAKE_POINTS;
      continue;
    }
    staying.push(car);
  }
  state.traffic = staying;

  for (const pickup of state.pickups) pickup.y += (state.speed + 2) * dt;
  const remaining = [];
  for (const pickup of state.pickups) {
    if (!overlaps(pickup, state.car)) {
      if (pickup.y <= FIELD_H + 1) remaining.push(pickup);
      continue;
    }
    state.nitro = Math.min(NITRO_MAX, state.nitro + NITRO_PICKUP);
    events.collected += 1;
    state.message = `NITRO +${NITRO_PICKUP}`;
    state.messageTimer = 1.1;
  }
  state.pickups = remaining;

  return events;
}
