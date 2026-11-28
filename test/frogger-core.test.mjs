import test from 'node:test';
import assert from 'node:assert/strict';
import { GRID, LIVES, NEAR_MISS_BONUS, ROAD_ROWS, RIVER_ROWS, SCORE_PER_SECOND, SPAWN_Y, movePlayer, newFrogger, stepFrogger } from '../public/games/frogger-core.mjs';

const FIXED = () => 0.25;

test('the player cannot leave the grid', () => {
  const state = newFrogger(FIXED);
  for (let i = 0; i < 20; i += 1) movePlayer(state, 'left');
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

test('the frog starts at the bottom of the start zone', () => {
  const state = newFrogger(FIXED);
  assert.equal(state.player.y, SPAWN_Y);
  assert.ok(state.player.y > RIVER_ROWS + ROAD_ROWS);
});

test('moving up raises the survival score', () => {
  const state = newFrogger(FIXED);
  state.pickupTimer = 99;
  const before = state.score;
  movePlayer(state, 'up');
  const result = stepFrogger(state, 0.25, FIXED);
  assert.equal(result.hit, false);
  assert.ok(state.score > before);
});

test('reaching the home row ends the run successfully', () => {
  const state = newFrogger(FIXED);
  state.player = { x: 4, y: 0 };
  const result = stepFrogger(state, 0.25, FIXED);
  assert.equal(result.reachedHome, true);
  assert.equal(state.over, true);
});

test('falling into the river without a log costs a life', () => {
  const state = newFrogger(FIXED);
  state.player = { x: 4, y: 1 };
  state.logs = [];
  const result = stepFrogger(state, 0.25, FIXED);
  assert.equal(result.hit, true);
  assert.equal(state.lives, LIVES - 1);
});

test('a shield absorbs the first hit without costing a life', () => {
  const state = newFrogger(FIXED);
  state.player = { x: 4, y: 1 };
  state.logs = [];
  state.shield = 1;
  const first = stepFrogger(state, 0.25, FIXED);
  assert.equal(first.hit, true);
  assert.equal(first.shieldUsed, true);
  assert.equal(state.lives, LIVES);

  state.logs = [];
  const second = stepFrogger(state, 0.25, FIXED);
  assert.equal(second.hit, true);
  assert.equal(second.shieldUsed, false);
  assert.equal(state.lives, LIVES - 1);
});

test('the near miss bonus is scored once per pass', () => {
  const state = newFrogger(FIXED);
  state.pickupTimer = 99;
  const log = state.logs[0];
  log.x = state.player.x + 0.6;
  log.y = state.player.y;
  log.vx = 0;
  const first = stepFrogger(state, 0.25, FIXED);
  assert.equal(first.nearMiss, 1);
  assert.ok(state.score > 0);
});
