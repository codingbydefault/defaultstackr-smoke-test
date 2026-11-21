import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, findPath, newLines, selectCell, spawnBalls } from '../public/games/lines-core.mjs';

const FIXED = () => 0.25;

test('findPath walks around occupied cells', () => {
  const board = Array(SIZE * SIZE).fill(null);
  board[0] = { color: 0 };
  board[1] = { color: 1 };
  const path = findPath(board, 0, SIZE + 1);
  assert.ok(path);
  assert.equal(path[0], 0);
  assert.equal(path.at(-1), SIZE + 1);
  assert.equal(findPath(board, 0, 0), null);
  assert.equal(findPath(board, 2, 2), null);
});

test('newLines spawns three balls', () => {
  const state = newLines(FIXED);
  assert.equal(state.board.filter(Boolean).length, 3);
  assert.equal(state.over, false);
});

test('moving a ball spawns three new ones', () => {
  const state = newLines(FIXED);
  const from = state.board.findIndex(Boolean);
  const to = state.board.findIndex((cell) => cell === null);
  state.selected = from;
  const result = selectCell(state, to, FIXED);
  assert.equal(result.type, 'move');
  assert.equal(state.board[from], null);
  assert.ok(state.board[to]);
  assert.equal(result.spawned.length, 3);
});

test('five in a row are cleared for points', () => {
  const state = newLines(FIXED);
  state.board = Array(SIZE * SIZE).fill(null);
  for (let x = 0; x < 4; x += 1) state.board[x] = { color: 2 };
  state.board[5] = { color: 2 };
  state.selected = 5;
  const result = selectCell(state, 4, FIXED);
  assert.equal(result.type, 'move');
  assert.ok(result.cleared.length >= 5);
  assert.equal(state.score, result.cleared.length * 10);
  for (const cell of result.cleared) assert.equal(state.board[cell], null);
});

test('spawnBalls marks the board full', () => {
  const state = { board: Array(SIZE * SIZE).fill({ color: 0 }), over: false, nextId: 0 };
  spawnBalls(state, 3, FIXED);
  assert.equal(state.over, true);
});
