// Trap!-style avoidance logic. Pure and deterministic with injected random.

export const GRID = 9;
export const BALLS = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makeBall(index, random) {
  const axis = Math.floor(random() * 2);
  const edge = random() < 0.5 ? 0 : GRID - 1;
  const along = 1 + Math.floor(random() * (GRID - 2));
  return {
    x: axis === 0 ? edge : along,
    y: axis === 0 ? along : edge,
    vx: (axis === 0 ? (edge === 0 ? 1 : -1) : (random() < 0.5 ? -1 : 1)) * 2.8,
    vy: (axis === 0 ? (random() < 0.5 ? -1 : 1) : (edge === 0 ? 1 : -1)) * 2.8,
    id: index
  };
}

export function newTrap(random = Math.random) {
  return {
    player: { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) },
    balls: Array.from({ length: BALLS }, (_, i) => makeBall(i, random)),
    score: 0,
    lives: 3,
    time: 0,
    over: false
  };
}

export function movePlayer(state, direction) {
  if (state.over) return state;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  state.player.x = clamp(state.player.x + dx, 0, GRID - 1);
  state.player.y = clamp(state.player.y + dy, 0, GRID - 1);
  return state;
}

export function stepTrap(state, dt, random = Math.random) {
  const result = { hit: false, lost: false };
  if (state.over) return result;

  state.time += dt;
  state.score += Math.floor(dt * 10);
  const speed = 1 + Math.min(1.6, state.time / 45);

  for (const ball of state.balls) {
    ball.x += ball.vx * dt * speed;
    ball.y += ball.vy * dt * speed;
    if (ball.x < 0) { ball.x = -ball.x; ball.vx = Math.abs(ball.vx); }
    if (ball.x > GRID - 1) { ball.x = 2 * (GRID - 1) - ball.x; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < 0) { ball.y = -ball.y; ball.vy = Math.abs(ball.vy); }
    if (ball.y > GRID - 1) { ball.y = 2 * (GRID - 1) - ball.y; ball.vy = -Math.abs(ball.vy); }
  }

  const caught = state.balls.some((ball) =>
    Math.round(ball.x) === state.player.x && Math.round(ball.y) === state.player.y);
  if (caught) {
    result.hit = true;
    state.lives -= 1;
    if (state.lives <= 0) {
      state.lives = 0;
      state.over = true;
      result.lost = true;
    } else {
      state.player = { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) };
      state.balls = Array.from({ length: BALLS }, (_, i) => makeBall(i, random));
    }
  }
  return result;
}
