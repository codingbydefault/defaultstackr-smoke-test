import { GRID, ROAD_ROWS, RIVER_ROWS, HOME_ROW, SPAWN_Y, movePlayer, newFrogger, stepFrogger } from './frogger-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 30;
const W = GRID * CELL;
const BEST_KEY = 'defaultstackr-nokia-frogger-best';

export function mountFrogger({ canvas, overlay, scoreNode, bestNode, statusNode, controls, onRunStart, onRunEnd }) {
  const ctx = createCanvas(canvas, W, W);
  let state = newFrogger();
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
    const base = state.reachedHome ? 'THANKS!'
      : state.over ? 'GAME OVER'
        : paused ? 'PAUSED'
          : `LIVES ${state.lives} · ${Math.floor(state.time)}S`;
    statusNode.textContent = tags.length ? `${base} · ${tags.join(' · ')}` : base;
  }

  function start() {
    state = newFrogger();
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
    const { hit, lost, reachedHome, collected, shieldUsed, nearMiss } = stepFrogger(state, dt);

    if (hit) {
      flash = 0.25;
      beep(true, shieldUsed ? 520 : 160, shieldUsed ? 0.2 : 0.18);
    }
    let message = '';
    if (nearMiss > 0) {
      message = `+${nearMiss * 25} VLAAUW!`;
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
      showOverlay(overlay, state.reachedHome
        ? { kicker: 'RETRO LCD · 1997', title: 'THANKS!', copy: `Je hebt de hogerval gemaakt in ${Math.floor(state.time)} seconden.`, action: 'SPEEL OPNIEUW ▶', onAction: start }
        : { kicker: 'RETRO LCD · 1997', title: 'GAME OVER.', copy: `Score ${state.score} · ${Math.floor(state.time)} seconden.`, action: 'OPNIEUW ▶', onAction: start });
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
    const roadTop = HOME_ROW + RIVER_ROWS + 1; // eerste snelwegrij = 4
    const roadBottom = HOME_ROW + RIVER_ROWS + ROAD_ROWS; // net onderste rij = 8
    for (let y = roadTop; y < roadBottom; y += 1) {
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(0, y * CELL, W, CELL);
    }
    for (const car of state.cars) {
      const cx = (car.x + 0.5) * CELL;
      const cy = (car.y + 0.5) * CELL;
      ctx.fillStyle = '#9bbc0f';
      ctx.strokeStyle = '#0f380f';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 11, cy - 11, 22, 22);
      ctx.strokeRect(cx - 11, cy - 11, 22, 22);
    }
    for (const log of state.logs) {
      const lx = (log.x + 0.5) * CELL;
      const ly = (log.y + 0.5) * CELL;
      const lw = log.len * CELL - 4;
      ctx.fillStyle = '#8bac0f';
      ctx.fillRect(lx - lw / 2, ly - 7, lw, 14);
      ctx.strokeStyle = '#0f380f';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx - lw / 2, ly - 7, lw, 14);
    }
    for (const pickup of state.pickups) {
      const px = (pickup.x + 0.5) * CELL;
      const py = (pickup.y + 0.5) * CELL;
      if (pickup.type === 'shield') {
        ctx.fillStyle = '#0f380f';
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9bbc0f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#0f380f';
        ctx.fillRect(px - 7, py - 7, 14, 14);
        ctx.strokeStyle = '#9bbc0f';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 7, py - 7, 14, 14);
      }
    }
    const frogX = (state.player.x + 0.5) * CELL;
    const frogY = (state.player.y + 0.5) * CELL;
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(frogX - 10, frogY - 10, 20, 20);
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(frogX - 3.5, frogY - 3.5, 7, 7);
    if (state.shield > 0) {
      ctx.strokeStyle = '#0f380f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(frogX, frogY, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#9bbc0f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(frogX, frogY, 21, 0, Math.PI * 2);
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
    kicker: 'RETRO LCD · 1997', title: 'FROGGER', copy: 'Oversteek de weg en de rivier naar het huis. Hoe langer je overleeft, hoe meer je verdient.', action: 'START ▶', onAction: start
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
