import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, clearLines, emptyBoard, hardDrop, lockPiece, newTetris, rotatePiece, stepTetris } from '../public/games/space-tetris-core.mjs';

test('a new game spawns a piece on the board', () => {
  const state = newTetris(() => 0);
  assert.equal(state.over, false);
  assert.equal(state.board.length, ROWS);
  assert.equal(state.board[0].length, COLS);
  assert.ok(state.piece.type);
});

test('rotating a piece changes its shape', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'I', rot: 0, x: 3, y: 5 };
  assert.equal(rotatePiece(state), true);
  assert.equal(state.piece.rot, 1);
});

test('a completed row is cleared and scored', () => {
  const board = emptyBoard();
  board[ROWS - 1] = Array(COLS).fill('I');
  assert.equal(clearLines(board), 1);
  assert.ok(board[ROWS - 1].every((cell) => cell === null));
});

test('hard drop locks the piece above the floor', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'O', rot: 0, x: 3, y: 0 };
  hardDrop(state, () => 0);
  assert.ok(state.board.some((row) => row.some(Boolean)));
  assert.ok(state.piece.y < ROWS);
});

test('gravity drops pieces over time', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'O', rot: 0, x: 3, y: 0 };
  const before = state.piece.y;
  stepTetris(state, 0.6, () => 0);
  assert.ok(state.piece.y > before || state.board.some((row) => row.some(Boolean)));
});

test('placing a piece scores one point per block', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'O', rot: 0, x: 3, y: 10 };
  lockPiece(state, () => 0);
  assert.equal(state.score, 4);
});

test('one cleared line adds five points on top of the placement points', () => {
  const state = newTetris(() => 0);
  state.board = emptyBoard();
  for (let x = 0; x < COLS; x += 1) {
    if (x !== 9 && x !== 10) state.board[ROWS - 1][x] = 'I';
  }
  state.piece = { type: 'O', rot: 0, x: 8, y: ROWS - 2 };
  assert.equal(lockPiece(state, () => 0), 1);
  assert.equal(state.score, 4 + 5);
});

test('two cleared lines add ten points on top of the placement points', () => {
  const state = newTetris(() => 0);
  state.board = emptyBoard();
  for (let x = 0; x < COLS; x += 1) {
    if (x !== 9 && x !== 10) {
      state.board[ROWS - 1][x] = 'I';
      state.board[ROWS - 2][x] = 'I';
    }
  }
  state.piece = { type: 'O', rot: 0, x: 8, y: ROWS - 2 };
  assert.equal(lockPiece(state, () => 0), 2);
  assert.equal(state.score, 4 + 10);
});
