import { BALL, H, PADDLE_W, W, movePaddle, newBounce, stepBounce } from './bounce-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 12;
const BEST_KEY = 'defaultstackr-nokia-bounce-best';

export function mountBounce({ canvas, overlay, scoreNode, bestNode, statusNode, controls, onRunStart, onRunEnd }) {
  const ctx = createCanvas(canvas, W * CELL, H * CELL);
  let state = newBounce();
  let best = getBest(BEST_KEY);
  let paused = false;
  let ended = false;
  let heldDirection = null;
  let elapsed = 0;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(state.score).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    statusNode.textContent = state.over ? 'GAME OVER' : paused ? 'PAUSED' : `WAVE ${state.wave} · ${state.lives} BALLS`;
  }

  function start() {
    state = newBounce();
    paused = false;
    ended = false;
    onRunStart?.();
    heldDirection = null;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) {
      showOverlay(overlay, {
        kicker: 'GAME PAUSED', title: 'Even stil.', copy: 'De bal wacht op je.', action: 'VERDER ▶', onAction: togglePause
      });
    } else hideOverlay(overlay);
    sync();
  }

  function input(action) {
    if (action === 'pause') { togglePause(); return; }
    if (action === 'start') { start(); return; }
    if (paused || state.over) return;
    if (action === 'left' || action === 'right') movePaddle(state, action, 0.1);
  }

  function update(dt) {
    elapsed += dt;
    if (paused || state.over) return;
    if (heldDirection) movePaddle(state, heldDirection, dt);
    const { paddleHit, brickHit, lost } = stepBounce(state, dt);
    if (paddleHit) beep(true, 520, 0.04);
    if (brickHit) beep(true, 760, 0.05);
    if (lost) beep(true, 200, 0.14);
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    if (state.over && !ended) {
      ended = true;
      onRunEnd?.(state.score);
      showOverlay(overlay, {
        kicker: 'SIGNAL LOST', title: 'Game over.', copy: `Score ${state.score} · wave ${state.wave}. Opnieuw?`, action: 'OPNIEUW ▶', onAction: start
      });
    }
    sync();
  }

  function fill(x, y, w, h, color = '#0f380f') {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL, y * CELL, w * CELL, h * CELL);
  }

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, W * CELL, H * CELL);

    ctx.fillStyle = 'rgba(48, 98, 15, .18)';
    for (let x = 0; x < W; x += 2) ctx.fillRect(x * CELL, H * CELL - 4, CELL, 2);

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      fill(brick.x, brick.y, brick.w, brick.h);
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect((brick.x + 0.4) * CELL, (brick.y + 0.25) * CELL, 2, 2);
    }

    fill(state.paddle.x, H - 2, PADDLE_W, 1);
    const ball = state.ball;
    if (Math.floor(elapsed * 10) % 2 === 0 || state.over) {
      fill(ball.x, ball.y, BALL, BALL);
    }
  }

  const stopSwipe = onSwipe(canvas, (direction) => {
    if (direction === 'left' || direction === 'right') input(direction);
  });
  const stopButtons = bindButtons(controls, {
    '[data-action="pause"]': togglePause
  });

  const cleanups = [];
  function hold(button, direction) {
    if (!button) return;
    const down = (event) => {
      event.preventDefault();
      heldDirection = direction;
      movePaddle(state, direction, 0.1);
    };
    const up = () => { if (heldDirection === direction) heldDirection = null; };
    button.addEventListener('pointerdown', down);
    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(event, up);
    cleanups.push(() => {
      button.removeEventListener('pointerdown', down);
      for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.removeEventListener(event, up);
    });
  }
  hold(controls.querySelector('[data-action="left"]'), 'left');
  hold(controls.querySelector('[data-action="right"]'), 'right');

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'RETRO LCD · 2001', title: 'BOUNCE', copy: 'Houd de bal in de lucht en breek de blokken.', action: 'START ▶', onAction: start
  });

  return {
    start,
    input,
    destroy() {
      loop.stop();
      stopSwipe();
      stopButtons();
      cleanups.forEach((cleanup) => cleanup());
    }
  };
}
