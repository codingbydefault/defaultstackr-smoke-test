// Paddle-and-bricks arcade logic for Bounce. Pure so it can be unit tested.

export const W = 28;
export const H = 22;
export const PADDLE_W = 6;
export const BALL = 1;

const BRICK_COLS = 8;
const BRICK_ROWS = 4;
const BRICK_W = 3;
const BRICK_H = 1;
const PADDLE_Y = H - 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createBricks() {
  const bricks = [];
  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      bricks.push({
        x: 0.25 + col * (BRICK_W + 0.5),
        y: 2 + row * 1.8,
        w: BRICK_W,
        h: BRICK_H,
        alive: true
      });
    }
  }
  return bricks;
}

function resetBall(state, random) {
  const direction = random() < 0.5 ? -1 : 1;
  state.ball = {
    x: state.paddle.x + PADDLE_W / 2 - BALL / 2,
    y: PADDLE_Y - 3,
    vx: direction * 6,
    vy: -8
  };
}

export function newBounce(random = Math.random) {
  const state = {
    paddle: { x: (W - PADDLE_W) / 2 },
    ball: { x: W / 2, y: PADDLE_Y - 3, vx: 6, vy: -8 },
    bricks: createBricks(),
    score: 0,
    lives: 3,
    hits: 0,
    wave: 1,
    over: false
  };
  return state;
}

export function movePaddle(state, direction, dt) {
  if (state.over) return state;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  state.paddle.x = clamp(state.paddle.x + dx * 24 * dt, 0, W - PADDLE_W);
  return state;
}

export function stepBounce(state, dt, random = Math.random) {
  const result = { paddleHit: false, brickHit: false, lost: false, cleared: false };
  if (state.over) return result;

  const ball = state.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < 0) {
    ball.x = -ball.x;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + BALL > W) {
    ball.x = 2 * (W - BALL) - ball.x;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < 0) {
    ball.y = -ball.y;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.y + BALL > H) {
    result.lost = true;
    state.lives -= 1;
    if (state.lives <= 0) {
      state.lives = 0;
      state.over = true;
    } else {
      resetBall(state, random);
    }
    return result;
  }

  if (ball.vy > 0 && ball.y + BALL >= PADDLE_Y && ball.y <= PADDLE_Y + 1 &&
      ball.x + BALL > state.paddle.x && ball.x < state.paddle.x + PADDLE_W) {
    ball.y = PADDLE_Y - BALL;
    const offset = ((ball.x + BALL / 2) - (state.paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2);
    const speed = Math.min(17, Math.hypot(ball.vx, ball.vy) + 0.25);
    ball.vx = clamp(offset * speed * 0.95, -speed * 0.85, speed * 0.85);
    if (Math.abs(ball.vx) < 2) ball.vx = offset >= 0 ? 2 : -2;
    ball.vy = -Math.sqrt(Math.max(25, speed * speed - ball.vx * ball.vx));
    state.hits += 1;
    state.score += 1;
    result.paddleHit = true;
  }

  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    if (ball.x + BALL <= brick.x || ball.x >= brick.x + brick.w ||
        ball.y + BALL <= brick.y || ball.y >= brick.y + brick.h) continue;
    brick.alive = false;
    ball.vy *= -1;
    state.score += 5;
    result.brickHit = true;
    break;
  }

  if (state.bricks.every((brick) => !brick.alive)) {
    state.wave += 1;
    state.bricks = createBricks();
    resetBall(state, random);
    result.cleared = true;
  }
  return result;
}
