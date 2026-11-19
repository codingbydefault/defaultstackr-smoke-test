export const GRID = 22;

export const VECTORS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
});

const OPPOSITE = Object.freeze({ up: 'down', right: 'left', down: 'up', left: 'right' });

export function placeFood(snake, random = Math.random) {
  const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`));
  const free = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (!free.length) return null;
  const index = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
  return free[index];
}

export function newGame(random = Math.random) {
  const snake = [{ x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 }];
  return { snake, food: placeFood(snake, random), direction: 'right', queued: 'right', score: 0, phase: 'ready' };
}

export function turn(game, direction) {
  if (!Object.hasOwn(VECTORS, direction) || OPPOSITE[game.direction] === direction || !['ready', 'running'].includes(game.phase)) return game;
  return { ...game, queued: direction };
}

export function advance(game, random = Math.random) {
  if (game.phase !== 'running') return game;
  const direction = game.queued;
  const vector = VECTORS[direction];
  const head = { x: game.snake[0].x + vector.x, y: game.snake[0].y + vector.y };
  const ate = game.food && head.x === game.food.x && head.y === game.food.y;
  const body = ate ? game.snake : game.snake.slice(0, -1);
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || body.some(part => part.x === head.x && part.y === head.y)) {
    return { ...game, direction, queued: direction, phase: 'over' };
  }
  const snake = [head, ...body];
  if (!ate) return { ...game, snake, direction, queued: direction };
  const food = placeFood(snake, random);
  return { ...game, snake, food, score: game.score + 1, direction, queued: direction, phase: food ? 'running' : 'won' };
}
