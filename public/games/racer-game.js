import {
  BOOST_COST, BOOST_SCROLL_MULT, CAR_H, CAR_W, FIELD_H, FIELD_W,
  NITRO_MAX, ROAD_LEFT, ROAD_RIGHT, boostRacer, newRacer, racerScore,
  steerRacer, stepRacer
} from './racer-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 22;
const W = FIELD_W * CELL;
const H = FIELD_H * CELL;
const BEST_KEY = 'defaultstackr-nokia-racer-best';

const LIGHT = '#9bbc0f';
const MID = '#8bac0f';
const DARK = '#306230';
const INK = '#0f380f';
const BODY_COLORS = [DARK, INK, '#234f12'];

export function mountRacer({ canvas, overlay, scoreNode, bestNode, statusNode, balanceNode, controls }) {
  const ctx = createCanvas(canvas, W, H);
  let state = newRacer();
  let best = getBest(BEST_KEY);
  let started = false;
  let paused = false;
  let ended = false;
  let heldDirection = null;
  let tapStart = null;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(racerScore(state)).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    const base = state.over ? 'WRECK' : paused ? 'PAUSED'
      : `LIVES ${state.lives} · NITRO ${String(Math.round(state.nitro)).padStart(3, '0')}%`;
    const tags = [];
    if (state.boostTime > 0) tags.push(`BOOST ${state.boostTime.toFixed(1)}S`);
    if (state.messageTimer > 0 && state.message) tags.push(state.message);
    statusNode.textContent = tags.length ? `${base} · ${tags.join(' · ')}` : base;
    if (balanceNode) {
      balanceNode.textContent = String(Math.round(state.nitro)).padStart(3, '0');
      balanceNode.classList.toggle('low', state.nitro < BOOST_COST);
    }
  }

  function start() {
    state = newRacer();
    started = true;
    paused = false;
    ended = false;
    heldDirection = null;
    tapStart = null;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (!started || state.over) return;
    paused = !paused;
    if (paused) {
      showOverlay(overlay, {
        kicker: 'RACE PAUSED', title: 'Even stil.', copy: 'De weg wacht op je.', action: 'VERDER ▶', onAction: togglePause
      });
    } else hideOverlay(overlay);
    sync();
  }

  function input(action) {
    if (action === 'start') { start(); return; }
    if (action === 'pause') { togglePause(); return; }
    if (!started || paused || state.over) return;
    if (action === 'left' || action === 'right') {
      steerRacer(state, action, 0.12);
    } else if (action === 'fire') {
      if (boostRacer(state)) {
        beep(true, 720, 0.09);
        sync();
      } else {
        beep(true, 180, 0.06);
      }
    }
  }

  function update(dt) {
    if (!started || paused || state.over) return;
    if (heldDirection) steerRacer(state, heldDirection, dt);
    const events = stepRacer(state, dt);
    if (events.boosted) beep(true, 980, 0.13);
    if (events.hit) beep(true, 150, 0.22);
    if (events.collected) beep(true, 620, 0.1);
    if (events.passed) beep(true, 480, 0.035);
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    if (state.over && !ended) {
      ended = true;
      showOverlay(overlay, {
        kicker: 'RACE OVER', title: 'Checkered flag.',
        copy: `Score ${racerScore(state)} · ${Math.floor(state.distance)} meter · ${state.passed} ingehaald.`,
        action: 'OPNIEUW ▶', onAction: start
      });
    }
    sync();
  }

  function fill(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL, y * CELL, w * CELL, h * CELL);
  }

  function drawRoad() {
    const scroll = Math.floor(state.distance * CELL);
    for (let y = 0; y < FIELD_H; y += 2) {
      const stripe = Math.floor((y + scroll / CELL) / 2) % 2 === 0;
      fill(0, y, ROAD_LEFT, 2, stripe ? MID : DARK);
      fill(ROAD_RIGHT, y, FIELD_W - ROAD_RIGHT, 2, stripe ? DARK : MID);
    }
    fill(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, FIELD_H, MID);

    ctx.fillStyle = DARK;
    ctx.fillRect(ROAD_LEFT * CELL, 0, 2, H);
    ctx.fillRect(ROAD_RIGHT * CELL - 2, 0, 2, H);

    const period = CELL * 3;
    const offset = scroll % period;
    const center = (ROAD_LEFT + (ROAD_RIGHT - ROAD_LEFT) / 2) * CELL;
    const guideA = (ROAD_LEFT + (ROAD_RIGHT - ROAD_LEFT) / 4) * CELL;
    const guideB = (ROAD_LEFT + 3 * (ROAD_RIGHT - ROAD_LEFT) / 4) * CELL;
    for (let y = -period + offset; y < H; y += period) {
      ctx.fillStyle = INK;
      ctx.fillRect(center - 2, y, 4, CELL * 1.25);
      ctx.fillStyle = DARK;
      ctx.fillRect(guideA - 1, y + CELL, 2, CELL * 0.7);
      ctx.fillRect(guideB - 1, y + CELL, 2, CELL * 0.7);
    }

    if (state.boostTime > 0) {
      ctx.fillStyle = 'rgba(155, 188, 15, .35)';
      for (let i = 0; i < 9; i += 1) {
        const y = ((i * 97 + scroll * 2) % (H + 90)) - 50;
        const x = (ROAD_LEFT + 0.4 + ((i * 3) % 8)) * CELL;
        ctx.fillRect(x, y, 3, CELL);
      }
    }
  }

  function drawCar(car, player) {
    const x = Math.round(car.x);
    const y = Math.round(car.y);
    const body = player ? INK : (BODY_COLORS[(car.tone || 0) % BODY_COLORS.length] || DARK);
    fill(x, y, car.w || CAR_W, car.h || CAR_H, body);
    const front = player ? y + (car.h || CAR_H) - 1 : y;
    const back = player ? y : y + (car.h || CAR_H) - 1;
    fill(x, front, car.w || CAR_W, 1, MID);
    fill(x, back, car.w || CAR_W, 1, DARK);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x * CELL + 4, front * CELL + 6, (car.w || CAR_W) * CELL - 8, 4);
    ctx.fillStyle = INK;
    ctx.fillRect(x * CELL - 2, y * CELL + 5, 3, 6);
    ctx.fillRect((x + (car.w || CAR_W)) * CELL - 1, y * CELL + 5, 3, 6);
  }

  function drawNitro(pickup) {
    const x = Math.round(pickup.x);
    const y = Math.round(pickup.y);
    fill(x, y, 2, 3, INK);
    ctx.fillStyle = MID;
    ctx.fillRect(x * CELL + 3, y * CELL + 3, CELL * 2 - 6, CELL + 2);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x * CELL + 5, y * CELL + 6, 3, CELL);
    ctx.fillRect(x * CELL + CELL + 4, y * CELL + 6, 3, CELL);
    ctx.fillRect(x * CELL + 5, y * CELL + CELL + 4, CELL + 2, 3);
  }

  function drawHud() {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, CELL * 2);
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = LIGHT;
    ctx.fillText(`SCORE ${String(racerScore(state)).padStart(5, '0')}`, 6, 17);
    ctx.fillText(`${Math.floor(state.distance)}M`, W - 68, 17);

    ctx.fillStyle = state.boostTime > 0 ? LIGHT : MID;
    ctx.fillText('N2O', 6, 35);
    ctx.strokeStyle = MID;
    ctx.lineWidth = 1;
    ctx.strokeRect(41.5, 23.5, 102, 13);
    ctx.fillStyle = state.boostTime > 0 ? LIGHT : DARK;
    ctx.fillRect(43, 25, 99 * Math.max(0, Math.min(NITRO_MAX, state.nitro)) / NITRO_MAX, 10);

    ctx.fillStyle = state.boostTime > 0 ? LIGHT : MID;
    ctx.fillText(state.boostTime > 0 ? `x${BOOST_SCROLL_MULT.toFixed(1)}` : `L${state.level}`, W - 46, 35);
  }

  function draw() {
    ctx.fillStyle = LIGHT;
    ctx.fillRect(0, 0, W, H);
    drawRoad();

    for (const pickup of state.pickups) drawNitro(pickup);
    for (const car of state.traffic) drawCar(car, false);
    if (!state.over && (state.invuln <= 0 || Math.floor(state.time * 14) % 2 === 0)) {
      if (state.boostTime > 0) {
        ctx.fillStyle = 'rgba(155, 188, 15, .38)';
        ctx.fillRect((state.car.x - 0.4) * CELL, state.car.y * CELL - 6, (CAR_W + 0.8) * CELL, (CAR_H + 0.6) * CELL);
      }
      drawCar(state.car, true);
    }

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(15, 56, 15, ${Math.min(0.55, state.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawHud();

    if (state.messageTimer > 0 && state.message) {
      ctx.font = 'bold 12px monospace';
      const tw = Math.ceil(ctx.measureText(state.message).width) + 18;
      const x = (W - tw) / 2;
      const y = H - CELL * 2.1;
      ctx.fillStyle = INK;
      ctx.fillRect(x, y, tw, 22);
      ctx.strokeStyle = LIGHT;
      ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, 21);
      ctx.fillStyle = LIGHT;
      ctx.fillText(state.message, x + 9, y + 15);
    }
  }

  function pressDirection(direction) {
    heldDirection = direction;
    input(direction);
  }

  const stopButtons = bindButtons(controls, {
    '[data-action="left"]': () => pressDirection('left'),
    '[data-action="right"]': () => pressDirection('right'),
    '[data-action="fire"]': () => input('fire'),
    '[data-action="pause"]': togglePause
  });

  const stopSwipe = onSwipe(canvas, (direction) => {
    if (direction === 'left' || direction === 'right') input(direction);
    else if (direction === 'up') input('fire');
  });

  const cleanups = [];
  const clearHeld = () => { heldDirection = null; };
  document.addEventListener('pointerup', clearHeld);
  document.addEventListener('pointercancel', clearHeld);
  cleanups.push(() => {
    document.removeEventListener('pointerup', clearHeld);
    document.removeEventListener('pointercancel', clearHeld);
  });

  const canvasDown = (event) => {
    tapStart = { x: event.clientX, y: event.clientY, moved: false };
  };
  const canvasMove = (event) => {
    if (tapStart && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > 16) tapStart.moved = true;
  };
  const canvasUp = (event) => {
    if (!tapStart) return;
    const moved = tapStart.moved;
    tapStart = null;
    if (moved) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;
    input(ratio < 0.5 ? 'left' : 'right');
  };
  const canvasCancel = () => { tapStart = null; };
  canvas.addEventListener('pointerdown', canvasDown);
  canvas.addEventListener('pointermove', canvasMove);
  canvas.addEventListener('pointerup', canvasUp);
  canvas.addEventListener('pointercancel', canvasCancel);
  cleanups.push(() => {
    canvas.removeEventListener('pointerdown', canvasDown);
    canvas.removeEventListener('pointermove', canvasMove);
    canvas.removeEventListener('pointerup', canvasUp);
    canvas.removeEventListener('pointercancel', canvasCancel);
  });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'RETRO LCD · 2003',
    title: 'POLE POSITION',
    copy: 'Stuur met ◀ ▶, swipe of tik op het scherm. Pak nitroblikjes en tik FIRE voor een boost.',
    action: 'START ▶',
    onAction: start
  });

  // The hub owns the document keydown listener (arrows / Space / P), so this
  // game does not install a second one.

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
