import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BALLS, GRID, MAX_BALLS, NEAR_MISS_BONUS, SLOW_DURATION, SLOW_FACTOR,
  movePlayer, newTrap, stepTrap
} from '../public/games/trap-core.mjs';

const FIXED = () => 0.25;

test('the player cannot leave the grid', () => {
  const state = newTrap(FIXED);
  for (let i = 0; i < 10; i += 1) movePlayer(state, 'left');
  assert.equal(state.player.x, 0);
  movePlayer(state, 'right');
  assert.equal(state.player.x, 1);
  state.player.y = 0;
  movePlayer(state, 'up');
  assert.equal(state.player.y, 0);
  state.player.y = GRID - 1;
  movePlayer(state, 'down');
  assert.equal(state.player.y, GRID - 1);
});

test('balls bounce inside the grid and time raises the score', () => {
  const state = newTrap(FIXED);
  const ball = state.balls[0];
  ball.x = -0.1;
  ball.y = GRID;
  ball.vx = -3;
  ball.vy = 3;
  stepTrap(state, 0.1, FIXED);
  assert.ok(ball.x >= 0);
  assert.ok(ball.vx > 0);
  assert.ok(ball.y <= GRID - 1);
  assert.ok(ball.vy < 0);
  assert.ok(state.score > 0);
});

test('a catch costs a life and ends the game at zero', () => {
  const state = newTrap(FIXED);
  state.lives = 1;
  state.balls = [{ x: state.player.x, y: state.player.y, vx: 0, vy: 0, id: 0 }];
  const result = stepTrap(state, 0.1, FIXED);
  assert.equal(result.hit, true);
  assert.equal(result.lost, true);
  assert.equal(state.lives, 0);
  assert.equal(state.over, true);
});

test('a shield absorbs one hit without costing a life', () => {
  const state = newTrap(FIXED);
  state.shield = 1;
  state.balls = [{ x: state.player.x, y: state.player.y, vx: 0, vy: 0, id: 0 }];
  const result = stepTrap(state, 0.1, FIXED);
  assert.equal(result.hit, true);
  assert.equal(result.shieldUsed, true);
  assert.equal(result.lost, false);
  assert.equal(state.lives, 3);
  assert.equal(state.shield, 0);
  assert.equal(state.over, false);

  // With the shield spent the same catch now costs a life.
  state.balls = [{ x: state.player.x, y: state.player.y, vx: 0, vy: 0, id: 0 }];
  const next = stepTrap(state, 0.1, FIXED);
  assert.equal(next.shieldUsed, false);
  assert.equal(state.lives, 2);
});

test('pickups drift in and grant a shield or slow motion when overlapped', () => {
  const state = newTrap(FIXED);
  state.balls = [0, 1, 2].map((id) => ({ x: 0, y: id, vx: 0, vy: 0, id }));
  state.pickupTimer = 0;
  stepTrap(state, 0.1, () => 0.1); // values below 0.5 pick the shield type
  assert.equal(state.pickups.length, 1);
  assert.equal(state.pickups[0].type, 'shield');
  state.player = { x: Math.round(state.pickups[0].x), y: Math.round(state.pickups[0].y) };
  state.pickupTimer = 99;
  const shieldResult = stepTrap(state, 0.1, FIXED);
  assert.deepEqual(shieldResult.collected, ['shield']);
  assert.equal(state.shield, 1);
  assert.equal(state.pickups.length, 0);

  state.pickupTimer = 0;
  stepTrap(state, 0.1, () => 0.9); // values at or above 0.5 pick the slow type
  assert.equal(state.pickups[0].type, 'slow');
  state.player = { x: Math.round(state.pickups[0].x), y: Math.round(state.pickups[0].y) };
  state.pickupTimer = 99;
  const slowResult = stepTrap(state, 0.1, FIXED);
  assert.deepEqual(slowResult.collected, ['slow']);
  assert.equal(state.slowTime, SLOW_DURATION);
});

test('near-miss bonus is scored once per pass', () => {
  const state = newTrap(FIXED);
  state.pickupTimer = 99;
  const ball = state.balls[0];
  state.balls = [ball];
  ball.x = state.player.x + 0.6;
  ball.y = state.player.y;
  ball.vx = 0;
  ball.vy = 0;

  const first = stepTrap(state, 0.1, FIXED);
  assert.equal(first.hit, false);
  assert.equal(first.nearMiss, 1);
  const scoreAfterFirst = state.score;

  const second = stepTrap(state, 0.1, FIXED);
  assert.equal(second.nearMiss, 0);
  assert.equal(state.score - scoreAfterFirst, Math.floor(0.1 * 10)); // no repeat bonus

  // Leaving the area clears the per-ball flag so a new pass can score again.
  ball.x = 0;
  ball.y = 0;
  stepTrap(state, 0.1, FIXED);
  ball.x = state.player.x + 0.6;
  ball.y = state.player.y;
  const third = stepTrap(state, 0.1, FIXED);
  assert.equal(third.nearMiss, 1);
  assert.equal(state.score, scoreAfterFirst + Math.floor(0.1 * 10) * 3 + NEAR_MISS_BONUS);
});

test('balls escalate every 20 seconds and slightly raise the speed', () => {
  const state = newTrap(FIXED);
  state.pickupTimer = 99;
  state.balls = [{ x: 1, y: 1, vx: 2.8, vy: 0, id: 0 }];
  state.time = 19.9;
  stepTrap(state, 0.2, FIXED);
  assert.equal(state.balls.length, BALLS + 1);
  assert.equal(state.level, 1);

  const make = (time) => {
    const s = newTrap(FIXED);
    s.pickupTimer = 99;
    s.balls = [{ x: 1, y: 1, vx: 2.8, vy: 0, id: 0 }];
    s.time = time;
    return s;
  };
  const earlier = make(19);
  const later = make(21);
  stepTrap(earlier, 0.1, FIXED);
  stepTrap(later, 0.1, FIXED);
  assert.ok(later.balls[0].x > earlier.balls[0].x);

  const capped = newTrap(FIXED);
  capped.pickupTimer = 99;
  capped.time = 120;
  stepTrap(capped, 0.1, FIXED);
  assert.equal(capped.balls.length, MAX_BALLS);
  assert.equal(capped.level, MAX_BALLS - BALLS);
});

test('slow motion scales ball movement while active', () => {
  const make = (slowTime) => {
    const s = newTrap(FIXED);
    s.pickupTimer = 99;
    s.balls = [{ x: 1, y: 1, vx: 2.8, vy: 0, id: 0 }];
    s.slowTime = slowTime;
    return s;
  };
  const normal = make(0);
  const slowed = make(SLOW_DURATION);
  stepTrap(normal, 0.1, FIXED);
  stepTrap(slowed, 0.1, FIXED);

  const normalDx = normal.balls[0].x - 1;
  const slowDx = slowed.balls[0].x - 1;
  assert.ok(normalDx > 0);
  assert.ok(Math.abs(slowDx / normalDx - SLOW_FACTOR) < 1e-9);
  assert.ok(slowed.slowTime > 0 && slowed.slowTime < SLOW_DURATION);
});
