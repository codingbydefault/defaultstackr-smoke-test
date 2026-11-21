import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, clearLines, emptyBoard, hardDrop, holdPiece, lockPiece, newTetris, rotatePiece, softDrop, stepTetris } from '../public/games/space-tetris-core.mjs';

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

test('first hold stores the piece and spawns a new one, but cannot be repeated', () => {
  const state = newTetris(() => 0);
  const first = state.piece.type;
  assert.equal(holdPiece(state, () => 0.99), true);
  assert.equal(state.hold, first);
  assert.notEqual(state.piece.type, first);
  assert.equal(state.canHold, false);
  // A second hold on the same spawned piece is rejected.
  assert.equal(holdPiece(state, () => 0.99), false);
  assert.equal(state.hold, first);
});

test('a lock restores hold and a later hold swaps the stored piece back in', () => {
  const state = newTetris(() => 0);
  const first = state.piece.type;
  holdPiece(state, () => 0.99);
  const swappedAway = state.piece.type;
  state.piece = { ...state.piece, y: 10 };
  lockPiece(state, () => 0.99);
  assert.equal(state.canHold, true);
  assert.equal(holdPiece(state, () => 0.99), true);
  assert.equal(state.piece.type, first);
  assert.equal(state.hold, swappedAway);
  assert.equal(holdPiece(state, () => 0.99), false);
});

test('counter-clockwise rotation is the inverse of clockwise rotation', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'I', rot: 0, x: 3, y: 5 };
  assert.equal(rotatePiece(state, -1), true);
  assert.equal(state.piece.rot, 3);
  assert.equal(rotatePiece(state), true);
  assert.equal(state.piece.rot, 0);
});

test('explicit soft drop awards one point per cell moved', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'O', rot: 0, x: 3, y: 0 };
  state.score = 0;
  assert.deepEqual(softDrop(state, () => 0), { moved: true, cleared: 0 });
  assert.equal(state.piece.y, 1);
  assert.equal(state.score, 1);
  softDrop(state, () => 0);
  assert.equal(state.piece.y, 2);
  assert.equal(state.score, 2);
});

test('gravity drops do not award soft-drop points', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'O', rot: 0, x: 3, y: 0 };
  state.score = 0;
  stepTetris(state, 0.6, () => 0);
  assert.equal(state.piece.y, 1);
  assert.equal(state.score, 0);
});

test('hard drop awards one point per cell dropped on top of the placement points', () => {
  const state = newTetris(() => 0);
  state.piece = { type: 'O', rot: 0, x: 3, y: 0 };
  state.score = 0;
  hardDrop(state, () => 0);
  assert.equal(state.board[ROWS - 1][4], 'O');
  assert.equal(state.score, 18 + 4);
});

function prepareLine(state) {
  state.board = emptyBoard();
  for (let x = 0; x < COLS; x += 1) {
    if (x !== 9 && x !== 10) state.board[ROWS - 1][x] = 'I';
  }
  state.piece = { type: 'O', rot: 0, x: 8, y: ROWS - 2 };
}

test('a chain of line clears adds a small combo bonus without breaking base scoring', () => {
  const state = newTetris(() => 0);
  prepareLine(state);
  assert.equal(lockPiece(state, () => 0), 1);
  assert.equal(state.score, 4 + 5);
  assert.equal(state.combo, 0);

  prepareLine(state);
  assert.equal(lockPiece(state, () => 0), 1);
  assert.equal(state.score, (4 + 5) + (4 + 5) + 2);
  assert.equal(state.combo, 1);

  prepareLine(state);
  assert.equal(lockPiece(state, () => 0), 1);
  assert.equal(state.combo, 2);
  assert.equal(state.score, 3 * (4 + 5) + 2 + 4);
});

test('locking without a line clears resets the combo', () => {
  const state = newTetris(() => 0);
  state.combo = 3;
  state.piece = { type: 'O', rot: 0, x: 3, y: 10 };
  assert.equal(lockPiece(state, () => 0), 0);
  assert.equal(state.combo, -1);
  assert.equal(state.score, 4);
});
