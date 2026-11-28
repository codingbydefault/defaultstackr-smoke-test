import { GRID, NEAR_MISS_BONUS, movePlayer, newTrap, stepTrap } from './trap-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 30;
const W = GRID * CELL;
const BEST_KEY = 'defaultstackr-nokia-trap-best';

export function mountTrap({ canvas, overlay, scoreNode, bestNode, statusNode, controls, onRunStart, onRunEnd }) {
  const ctx = createCanvas(canvas, W, W);
  let state = newTrap();
  let best = getBest(BEST_KEY);
  let paused = false;
  let ended = false;
  let held = null;
  let flash = 0;
  let bonusText = '';
  let bonusTimer = 0;

  const loop = createLoop(update, draw);

  function setBonus(text) {
    bonusText = text;
    bonusTimer = 1.4;
  }

  function sync() {
    scoreNode.textContent = String(state.score).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    const tags = [];
    if (state.shield > 0) tags.push('SHIELD');
    if (state.slowTime > 0) tags.push(`SLOW ${Math.ceil(state.slowTime)}S`);
    if (bonusTimer > 0 && bonusText) tags.push(bonusText);
    const base = state.over ? 'CAUGHT' : paused ? 'PAUSED' : `LIVES ${state.lives} · ${Math.floor(state.time)}S`;
    statusNode.textContent = tags.length ? `${base} · ${tags.join(' · ')}` : base;
  }

  function start() {
    state = newTrap();
    paused = false;
    ended = false;
    onRunStart?.();
    held = null;
    flash = 0;
    bonusText = '';
    bonusTimer = 0;
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
    const { hit, shieldUsed, nearMiss, collected } = stepTrap(state, dt);

    if (hit) {
      flash = 0.25;
      beep(true, shieldUsed ? 520 : 160, shieldUsed ? 0.2 : 0.18);
    }
    let message = '';
    if (nearMiss > 0) {
      message = `+${nearMiss * NEAR_MISS_BONUS} NEAR!`;
      beep(true, 880, 0.05);
    }
    if (collected.includes('shield')) {
      message = 'SHIELD UP!';
      beep(true, 660, 0.12);
    }
    if (collected.includes('slow')) {
      message = 'SLOW-MO!';
      beep(true, 440, 0.12);
    }
    if (shieldUsed && !message) message = 'BLOCKED!';
    if (message) setBonus(message);

    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    if (state.over && !ended) {
      ended = true;
      onRunEnd?.(state.score);
      showOverlay(overlay, {
        kicker: 'TRAP!', title: 'Game over.', copy: `Score ${state.score} · ${Math.floor(state.time)} seconden.`, action: 'OPNIEUW ▶', onAction: start
      });
    }
    if (flash > 0) flash = Math.max(0, flash - dt);
    if (bonusTimer > 0) {
      bonusTimer = Math.max(0, bonusTimer - dt);
      if (!bonusTimer) bonusText = '';
    }
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
    for (const pickup of state.pickups) {
      const cx = (pickup.x + 0.5) * CELL;
      const cy = (pickup.y + 0.5) * CELL;
      if (pickup.type === 'shield') {
        ctx.fillStyle = '#0f380f';
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9bbc0f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 9, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#0f380f';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 8, cy - 8, 16, 16);
        ctx.fillStyle = '#0f380f';
        ctx.fillRect(cx - 2, cy - 6, 4, 12);
        ctx.fillRect(cx - 6, cy - 2, 12, 4);
      }
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
    if (state.shield > 0) {
      ctx.strokeStyle = '#0f380f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#9bbc0f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.83, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (state.slowTime > 0) {
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(4, 4, 66, 18);
      ctx.strokeStyle = '#9bbc0f';
      ctx.lineWidth = 1;
      ctx.strokeRect(4.5, 4.5, 65, 17);
      ctx.fillStyle = '#9bbc0f';
      ctx.font = '10px monospace';
      ctx.fillText(`SLOW ${Math.ceil(state.slowTime)}S`, 10, 17);
    }
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
    kicker: 'RETRO LCD · 2000', title: 'TRAP!', copy: 'Ontwijk de rollende vallen. Hoe langer je overleeft, hoe hoger de score.', action: 'START ▶', onAction: start
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
