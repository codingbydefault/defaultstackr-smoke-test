// Lines '96-style logic: move a ball along free cells, match five in a line.

export const SIZE = 9;
export const COLORS = 7;

const index = (x, y) => y * SIZE + x;
const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

export function findPath(board, from, to) {
  if (from === to || board[to] !== null || board[from] === null) return null;
  const queue = [from];
  const parent = new Map([[from, null]]);
  while (queue.length) {
    const current = queue.shift();
    const x = current % SIZE;
    const y = Math.floor(current / SIZE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const next = index(nx, ny);
      if (parent.has(next)) continue;
      if (board[next] !== null && next !== to) continue;
      parent.set(next, current);
      if (next === to) {
        const path = [to];
        let step = current;
        while (step !== null) {
          path.unshift(step);
          step = parent.get(step);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

export function spawnBalls(state, count, random = Math.random) {
  const empty = [];
  state.board.forEach((cell, i) => { if (cell === null) empty.push(i); });
  const spawned = [];
  for (let i = 0; i < count && empty.length; i += 1) {
    const pick = Math.min(empty.length - 1, Math.floor(random() * empty.length));
    const at = empty.splice(pick, 1)[0];
    const color = Math.min(COLORS - 1, Math.floor(random() * COLORS));
    state.board[at] = { color, id: state.nextId += 1 };
    spawned.push(at);
  }
  if (state.board.every((cell) => cell !== null)) state.over = true;
  return spawned;
}

export function newLines(random = Math.random) {
  const state = {
    board: Array(SIZE * SIZE).fill(null),
    selected: null,
    score: 0,
    over: false,
    nextId: 0
  };
  spawnBalls(state, 3, random);
  return state;
}

function lineThrough(board, center, dx, dy) {
  const ball = board[center];
  if (!ball) return [];
  const cells = [center];
  for (const sign of [1, -1]) {
    let x = center % SIZE + dx * sign;
    let y = Math.floor(center / SIZE) + dy * sign;
    while (inside(x, y)) {
      const at = index(x, y);
      if (!board[at] || board[at].color !== ball.color) break;
      cells.push(at);
      x += dx * sign;
      y += dy * sign;
    }
  }
  return cells.length >= 5 ? cells : [];
}

export function selectCell(state, target, random = Math.random) {
  if (state.over) return { type: 'ignore' };
  if (state.board[target]) {
    state.selected = target;
    return { type: 'select', index: target };
  }
  if (state.selected === null) return { type: 'ignore' };

  const path = findPath(state.board, state.selected, target);
  if (!path) return { type: 'blocked' };

  state.board[target] = state.board[state.selected];
  state.board[state.selected] = null;
  state.selected = null;
  const spawned = spawnBalls(state, 3, random);

  const toClear = new Set();
  for (const center of [target, ...spawned]) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      for (const cell of lineThrough(state.board, center, dx, dy)) toClear.add(cell);
    }
  }
  for (const cell of toClear) state.board[cell] = null;
  state.score += toClear.size * 10;

  return { type: 'move', path, spawned, cleared: [...toClear] };
}
