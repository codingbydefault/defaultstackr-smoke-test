import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOST_COST, BOOST_DURATION, BOOST_SCORE_RATE, CAR_W, FIELD_H, INVULN_TIME,
  NITRO_MAX, NITRO_PICKUP, OVERTAKE_POINTS, ROAD_LEFT, ROAD_RIGHT,
  SCORE_RATE, boostRacer, newRacer, racerScore, steerRacer, stepRacer
} from '../public/games/racer-core.mjs';

const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};
const carAt = (x, y) => ({ id: 1, x, y, w: CAR_W, h: 3, speed: 1, tone: 0 });

test('newRacer creates a readable starting state inside the road', () => {
  const state = newRacer(() => 0.5);
  assert.equal(state.lives, 3);
  assert.equal(state.nitro, 0);
  assert.equal(state.over, false);
  assert.equal(state.score, 0);
  assert.deepEqual(state.traffic, []);
  assert.deepEqual(state.pickups, []);
  assert.ok(state.car.x >= ROAD_LEFT && state.car.x + CAR_W <= ROAD_RIGHT);
  assert.ok(state.car.y > FIELD_H / 2);
  assert.ok(state.spawnIn > 0 && state.pickupIn > 0);
  assert.ok(state.speed > 0);
  assert.equal(racerScore(state), 0);
});

test('steering is clamped to the road and does nothing after the game ends', () => {
  const state = newRacer(() => 0.5);
  steerRacer(state, 'left', 10);
  assert.equal(state.car.x, ROAD_LEFT);
  steerRacer(state, 'right', 10);
  assert.equal(state.car.x, ROAD_RIGHT - CAR_W);
  const parked = state.car.x;
  state.over = true;
  steerRacer(state, 'left', 1);
  assert.equal(state.car.x, parked);
});

test('traffic spawns at the top using the injected random sequence', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 0;
  state.pickupIn = 99;
  stepRacer(state, 0.02, sequence(0, 0.9));
  assert.equal(state.traffic.length, 1);
  assert.equal(state.traffic[0].x, ROAD_LEFT);
  assert.ok(state.traffic[0].y < 0);
  assert.ok(state.traffic[0].speed > 0);
});

test('stepping the road moves traffic down faster than the road scroll', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  state.traffic.push(carAt(ROAD_LEFT, 1));
  const speed = state.speed;
  const y = state.traffic[0].y;
  stepRacer(state, 0.1, () => 0.9);
  assert.ok(state.traffic[0].y - y > speed * 0.1);
  assert.ok(state.distance > 0);
});

test('overtaking a car increases the passed count and the score', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  state.traffic.push(carAt(state.car.x, FIELD_H - 0.2));
  const before = state.score;
  const events = stepRacer(state, 0.5, () => 0.9);
  assert.equal(events.passed, 1);
  assert.equal(state.passed, 1);
  assert.equal(state.traffic.length, 0);
  assert.equal(state.score - before, SCORE_RATE / 2 + OVERTAKE_POINTS);
});

test('a collision costs a life and grants brief invulnerability', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  state.traffic.push(carAt(state.car.x, state.car.y));
  const first = stepRacer(state, 0.02, () => 0.9);
  assert.equal(first.hit, true);
  assert.equal(state.lives, 2);
  assert.ok(state.invuln > 0 && state.invuln <= INVULN_TIME);

  state.traffic.push(carAt(state.car.x, state.car.y));
  const second = stepRacer(state, 0.02, () => 0.9);
  assert.equal(second.hit, false);
  assert.equal(state.lives, 2);
});

test('boost consumes nitro and doubles the passive score rate', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  state.nitro = NITRO_MAX;

  assert.equal(boostRacer(state), true);
  assert.equal(state.nitro, NITRO_MAX - BOOST_COST);
  assert.equal(state.boostTime, BOOST_DURATION);
  const boostedScore = state.score;
  const speed = state.speed;
  const events = stepRacer(state, 1, () => 0.9);
  assert.equal(events.boosted, true);
  assert.equal(state.score - boostedScore, BOOST_SCORE_RATE);
  assert.ok(state.speed > speed);

  const plain = newRacer(() => 0.5);
  plain.spawnIn = 99;
  plain.pickupIn = 99;
  const plainScore = plain.score;
  stepRacer(plain, 1, () => 0.9);
  assert.equal(plain.score - plainScore, SCORE_RATE);

  state.nitro = BOOST_COST - 1;
  assert.equal(boostRacer(state), false);
});

test('nitro pickups refill the tank and are consumed on contact', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  state.nitro = 5;
  state.pickups.push({ id: 1, x: state.car.x, y: state.car.y, w: 2, h: 2 });
  const events = stepRacer(state, 0.02, () => 0.9);
  assert.equal(events.collected, 1);
  assert.equal(state.nitro, 5 + NITRO_PICKUP);
  assert.ok(state.nitro <= NITRO_MAX);
  assert.equal(state.pickups.length, 0);
});

test('the run ends at zero lives and stays inert afterwards', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  state.lives = 1;
  state.traffic.push(carAt(state.car.x, state.car.y));
  const events = stepRacer(state, 0.02, () => 0.9);
  assert.equal(events.hit, true);
  assert.equal(state.lives, 0);
  assert.equal(state.over, true);
  assert.equal(boostRacer(state), false);
  const parked = state.car.x;
  steerRacer(state, 'left', 1);
  assert.equal(state.car.x, parked);
  assert.deepEqual(stepRacer(state, 0.5, () => 0.9), { passed: 0, hit: false, collected: 0, boosted: false });
});

test('difficulty rises with elapsed time', () => {
  const state = newRacer(() => 0.5);
  state.spawnIn = 99;
  state.pickupIn = 99;
  const speed = state.speed;
  stepRacer(state, 20, () => 0.9);
  assert.ok(state.level > 1);
  assert.ok(state.speed > speed);
});

test('the same random sequence produces the same race', () => {
  const values = [0.1, 0.8, 0.35, 0.6, 0.05, 0.95, 0.42, 0.7];
  const left = newRacer(sequence(...values));
  const right = newRacer(sequence(...values));
  const randomLeft = sequence(...values);
  const randomRight = sequence(...values);
  for (let i = 0; i < 40; i += 1) {
    if (i % 7 === 0) {
      steerRacer(left, 'left', 0.05);
      steerRacer(right, 'left', 0.05);
    }
    stepRacer(left, 0.05, randomLeft);
    stepRacer(right, 0.05, randomRight);
  }
  assert.deepEqual(left, right);
});
