import test from 'node:test';
import assert from 'node:assert/strict';
import { GRID, advance, newGame, placeFood, turn } from '../public/game-core.mjs';

test('food never appears inside the snake', () => {
  const game = newGame(() => 0);
  assert.ok(game.food);
  assert.equal(game.snake.some(part => part.x === game.food.x && part.y === game.food.y), false);
});

test('the snake cannot reverse into itself between ticks', () => {
  const game = { ...newGame(), phase: 'running' };
  assert.equal(turn(game, 'left'), game);
  const turned = turn(game, 'up');
  assert.equal(turn(turned, 'left').queued, 'up');
  assert.deepEqual(advance(turned).snake[0], { x: 8, y: 10 });
});

test('eating grows the snake and raises the score', () => {
  const game = { ...newGame(), food: { x: 9, y: 11 }, phase: 'running' };
  const next = advance(game, () => 0);
  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 1);
  assert.equal(next.phase, 'running');
});

test('wall and body collisions end the run', () => {
  const wall = { ...newGame(), snake: [{ x: GRID - 1, y: 4 }], phase: 'running' };
  assert.equal(advance(wall).phase, 'over');
  const body = { ...newGame(), snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 7, y: 5 }], phase: 'running' };
  assert.equal(advance(body).phase, 'over');
});

test('moving into the old tail cell is allowed', () => {
  const game = { ...newGame(), snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }], phase: 'running' };
  assert.equal(advance(game).phase, 'running');
});

test('filling the board wins', () => {
  const snake = [];
  for (let y = 0; y < GRID; y += 1) for (let x = 0; x < GRID; x += 1) if (x !== 1 || y !== 0) snake.push({ x, y });
  const game = { ...newGame(), snake, food: { x: 1, y: 0 }, phase: 'running' };
  const next = advance(game);
  assert.equal(next.phase, 'won');
  assert.equal(next.food, null);
  assert.equal(placeFood(next.snake), null);
});
