import { GRID, movePlayer, newTrap, stepTrap } from './trap-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 30;
const W = GRID * CELL;
const BEST_KEY = 'defaultstackr-nokia-trap-best';

export function mountTrap({ canvas, overlay, scoreNode, bestNode, statusNode, controls }) {
  const ctx = createCanvas(canvas, W, W);
  let state = newTrap();
  let best = getBest(BEST_KEY);
  let paused = false;
  let ended = false;
  let held = null;
  let flash = 0;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(state.score).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    statusNode.textContent = state.over ? 'CAUGHT' : paused ? 'PAUSED' : `LIVES ${state.lives} · ${Math.floor(state.time)}S`;
  }

  function start() {
    state = newTrap();
    paused = false;
    ended = false;
    held = null;
    flash = 0;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) showOverlay(overlay, {
      kicker: 'GAME PAUSED', title: 'Even stil.', copy: 'De vallen staan stil.', action: 'VERDER ▶', onAction: togglePause
    });
    else hideOverlay(overlay);
    sync();
  }

  function input(action) {
    if (action === 'pause') { togglePause(); return; }
    if (action === 'start') { start(); return; }
    if (paused || state.over) return;
    if (['up', 'down', 'left', 'right'].includes(action)) movePlayer(state, action);
  }

  function update(dt) {
    if (paused || state.over) return;
    if (held) movePlayer(state, held);
    const { hit } = stepTrap(state, dt);
    if (hit) {
      flash = 0.25;
      beep(true, 160, 0.18);
    }
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    if (state.over && !ended) {
      ended = true;
      showOverlay(overlay, {
        kicker: 'TRAP!', title: 'Game over.', copy: `Score ${state.score} · ${Math.floor(state.time)} seconden.`, action: 'OPNIEUW ▶', onAction: start
      });
    }
    if (flash > 0) flash = Math.max(0, flash - dt);
    sync();
  }

  function draw() {
    ctx.fillStyle = flash > 0 ? '#0f380f' : '#9bbc0f';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#8bac0f';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, W);
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(W, i * CELL + 0.5);
      ctx.stroke();
    }
    for (const ball of state.balls) {
      ctx.fillStyle = '#306230';
      ctx.beginPath();
      ctx.arc((ball.x + 0.5) * CELL, (ball.y + 0.5) * CELL, CELL / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9bbc0f';
      ctx.beginPath();
      ctx.arc((ball.x + 0.5) * CELL - 3, (ball.y + 0.5) * CELL - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const px = state.player.x * CELL;
    const py = state.player.y * CELL;
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(px + CELL / 2 - 2, py + CELL / 2 - 2, 4, 4);
  }

  const stopSwipe = onSwipe(canvas, (direction) => {
    if (['left', 'right', 'up', 'down'].includes(direction)) input(direction);
  });
  const stopButtons = bindButtons(controls, { '[data-action="pause"]': togglePause });
  const cleanups = [];
  for (const direction of ['left', 'right', 'up', 'down']) {
    const button = controls.querySelector(`[data-action="${direction}"]`);
    if (!button) continue;
    const down = (event) => { event.preventDefault(); held = direction; movePlayer(state, direction); };
    const up = () => { if (held === direction) held = null; };
    button.addEventListener('pointerdown', down);
    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(event, up);
    cleanups.push(() => {
      button.removeEventListener('pointerdown', down);
      for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.removeEventListener(event, up);
    });
  }

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'NOKIA · 2000', title: 'TRAP!', copy: 'Ontwijk de rollende vallen. Hoe langer je overleeft, hoe hoger de score.', action: 'START ▶', onAction: start
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
