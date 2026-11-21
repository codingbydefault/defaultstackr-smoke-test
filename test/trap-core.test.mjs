import test from 'node:test';
import assert from 'node:assert/strict';
import { GRID, movePlayer, newTrap, stepTrap } from '../public/games/trap-core.mjs';

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
