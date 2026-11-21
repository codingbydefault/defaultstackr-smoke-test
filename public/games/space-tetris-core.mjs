// Falling-block game logic. Pure enough to exercise in Node tests.

export const COLS = 10;
export const ROWS = 20;

const BASE = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]]
};

const rotateCells = (cells) => cells.map(([x, y]) => [3 - y, x]);

export const SHAPES = Object.fromEntries(Object.entries(BASE).map(([name, cells]) => {
  const rotations = [cells];
  for (let i = 1; i < 4; i += 1) rotations.push(rotateCells(rotations[i - 1]));
  return [name, rotations];
}));

const PIECE_NAMES = Object.keys(SHAPES);
const BLOCK_POINTS = 1;
const LINE_POINTS = 5;
const MOVE_POINTS = 1;
const COMBO_POINTS = 2;

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function collides(board, piece, dx = 0, dy = 0, rotation = piece.rot) {
  for (const [cx, cy] of SHAPES[piece.type][rotation]) {
    const x = piece.x + cx + dx;
    const y = piece.y + cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x]) return true;
  }
  return false;
}

function spawn(state, random) {
  const type = PIECE_NAMES[Math.min(PIECE_NAMES.length - 1, Math.floor(random() * PIECE_NAMES.length))];
  state.piece = { type, rot: 0, x: 3, y: 0 };
  // A fresh piece may be held exactly once.
  state.canHold = true;
  if (collides(state.board, state.piece)) state.over = true;
}

export function newTetris(random = Math.random) {
  const state = {
    board: emptyBoard(),
    piece: null,
    hold: null,
    canHold: true,
    combo: -1,
    score: 0,
    lines: 0,
    level: 1,
    drop: 0,
    over: false
  };
  spawn(state, random);
  return state;
}

export function movePiece(state, dx) {
  if (state.over || collides(state.board, state.piece, dx)) return false;
  state.piece = { ...state.piece, x: state.piece.x + dx };
  return true;
}

// direction 1 rotates clockwise, -1 rotates counter-clockwise.
export function rotatePiece(state, direction = 1) {
  if (state.over) return false;
  const rotation = (state.piece.rot + direction + 4) % 4;
  if (collides(state.board, state.piece, 0, 0, rotation)) return false;
  state.piece = { ...state.piece, rot: rotation };
  return true;
}

export function holdPiece(state, random = Math.random) {
  if (state.over || !state.canHold || !state.piece) return false;
  const current = state.piece.type;
  if (state.hold) {
    state.piece = { type: state.hold, rot: 0, x: 3, y: 0 };
    state.hold = current;
  } else {
    state.hold = current;
    spawn(state, random);
  }
  // Both branches (including the spawn above) lock hold until the next piece.
  state.canHold = false;
  if (collides(state.board, state.piece)) state.over = true;
  return true;
}

export function clearLines(board) {
  let cleared = 0;
  for (let y = board.length - 1; y >= 0; y -= 1) {
    if (!board[y].every(Boolean)) continue;
    board.splice(y, 1);
    board.unshift(Array(COLS).fill(null));
    cleared += 1;
    y += 1;
  }
  return cleared;
}

export function lockPiece(state, random = Math.random) {
  if (state.over) return 0;
  for (const [cx, cy] of SHAPES[state.piece.type][state.piece.rot]) {
    const x = state.piece.x + cx;
    const y = state.piece.y + cy;
    if (y >= 0) state.board[y][x] = state.piece.type;
  }
  const cleared = clearLines(state.board);
  // The first clear of a chain has combo 0, so the classic 1/block + 5/line
  // contract (4, 9, 14 points) stays exactly the same. Only extra chains bonus.
  if (cleared > 0) state.combo += 1;
  else state.combo = -1;
  const comboBonus = cleared > 0 ? COMBO_POINTS * state.combo : 0;
  const placedBlocks = SHAPES[state.piece.type][state.piece.rot].length;
  state.score += placedBlocks * BLOCK_POINTS + cleared * LINE_POINTS + comboBonus;
  state.lines += cleared;
  state.level = 1 + Math.floor(state.lines / 10);
  state.drop = 0;
  spawn(state, random);
  return cleared;
}

export function softDrop(state, random = Math.random, scoreMove = true) {
  if (state.over) return { moved: false, cleared: 0 };
  if (!collides(state.board, state.piece, 0, 1)) {
    state.piece = { ...state.piece, y: state.piece.y + 1 };
    if (scoreMove) state.score += MOVE_POINTS;
    return { moved: true, cleared: 0 };
  }
  return { moved: false, cleared: lockPiece(state, random) };
}

export function hardDrop(state, random = Math.random) {
  if (state.over) return 0;
  let dropped = 0;
  while (!collides(state.board, state.piece, 0, 1)) {
    state.piece = { ...state.piece, y: state.piece.y + 1 };
    dropped += 1;
  }
  state.score += dropped * MOVE_POINTS;
  return lockPiece(state, random);
}

export function ghostY(state) {
  let y = state.piece.y;
  while (!collides(state.board, { ...state.piece, y: y + 1 })) y += 1;
  return y;
}

export function stepTetris(state, dt, random = Math.random) {
  if (state.over) return { cleared: 0 };
  state.drop += dt;
  const interval = Math.max(0.08, 0.55 - (state.level - 1) * 0.05);
  let cleared = 0;
  while (state.drop >= interval && !state.over) {
    state.drop -= interval;
    // Gravity is free: only an explicit soft drop is worth a point per cell.
    cleared += softDrop(state, random, false).cleared;
  }
  return { cleared };
}
