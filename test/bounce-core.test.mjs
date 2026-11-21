import test from 'node:test';
import assert from 'node:assert/strict';
import { H, PADDLE_W, W, movePaddle, newBounce, stepBounce } from '../public/games/bounce-core.mjs';

const FIXED = () => 0.25;

test('the paddle stays inside the playfield', () => {
  const state = newBounce(FIXED);
  movePaddle(state, 'left', 10);
  assert.equal(state.paddle.x, 0);
  movePaddle(state, 'right', 10);
  assert.equal(state.paddle.x, W - PADDLE_W);
});

test('the ball bounces off side walls', () => {
  const state = newBounce(FIXED);
  state.ball = { x: -0.2, y: 12, vx: -6, vy: 0 };
  stepBounce(state, 0.1, FIXED);
  assert.ok(state.ball.x >= 0);
  assert.ok(state.ball.vx > 0);

  state.ball = { x: W - 0.5, y: 12, vx: 6, vy: 0 };
  stepBounce(state, 0.1, FIXED);
  assert.ok(state.ball.x + 1 <= W);
  assert.ok(state.ball.vx < 0);
});

test('a paddle hit scores one point and sends the ball up', () => {
  const state = newBounce(FIXED);
  state.ball = { x: state.paddle.x + PADDLE_W / 2 - 0.5, y: H - 3.05, vx: 0, vy: 8 };
  const result = stepBounce(state, 0.1, FIXED);
  assert.equal(result.paddleHit, true);
  assert.equal(state.score, 1);
  assert.equal(state.hits, 1);
  assert.ok(state.ball.vy < 0);
});

test('breaking a brick scores five points', () => {
  const state = newBounce(FIXED);
  state.ball = { x: 1, y: 1.4, vx: 0, vy: 5 };
  const result = stepBounce(state, 0.1, FIXED);
  assert.equal(result.brickHit, true);
  assert.equal(state.score, 5);
  assert.equal(state.bricks.filter((brick) => brick.alive).length, state.bricks.length - 1);
});

test('losing the ball costs a life and ends the game at zero', () => {
  const state = newBounce(FIXED);
  state.lives = 1;
  state.ball = { x: 5, y: H - 1.05, vx: 0, vy: 8 };
  const result = stepBounce(state, 0.1, FIXED);
  assert.equal(result.lost, true);
  assert.equal(state.lives, 0);
  assert.equal(state.over, true);
});
