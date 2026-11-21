import { FIELD_H, FIELD_W, enemySize, fireImpact, moveShip, newImpact, stepImpact } from './impact-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 10;
const W = FIELD_W * CELL;
const H = FIELD_H * CELL;
const BEST_KEY = 'defaultstackr-nokia-impact-best';
const STARS = Array.from({ length: 42 }, (_, i) => ({ x: (i * 13 + 2) % FIELD_W, y: (i * 7 + 4) % FIELD_H }));

export function mountImpact({ canvas, overlay, scoreNode, bestNode, statusNode, controls }) {
  const ctx = createCanvas(canvas, W, H);
  let state = newImpact();
  let best = getBest(BEST_KEY);
  let paused = false;
  let ended = false;
  let elapsed = 0;
  let heldDirection = null;
  let firing = false;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(state.score).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    const base = state.over ? 'SHIP LOST' : paused ? 'PAUSED' : `LIVES ${state.lives} · WAVE ${state.level}`;
    const tags = [];
    if (state.weaponTime > 0) tags.push(`3WAY ${state.weaponTime.toFixed(1)}S`);
    if (state.shield > 0) tags.push('SHIELD');
    statusNode.textContent = tags.length ? `${base} · ${tags.join(' · ')}` : base;
  }

  function start() {
    state = newImpact();
    paused = false;
    ended = false;
    heldDirection = null;
    firing = false;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) {
      showOverlay(overlay, {
        kicker: 'ORBIT PAUSED', title: 'Even stil.', copy: 'Je schip zweeft.', action: 'VERDER ▶', onAction: togglePause
      });
    } else hideOverlay(overlay);
    sync();
  }

  function input(action) {
    if (action === 'pause') { togglePause(); return; }
    if (action === 'start') { start(); return; }
    if (paused || state.over) return;
    if (action === 'up') moveShip(state, 'up', 0.1);
    else if (action === 'down') moveShip(state, 'down', 0.1);
    else if (action === 'fire') fireImpact(state);
    else if (['left', 'right', 'rotate', 'soft', 'drop'].includes(action)) fireImpact(state);
  }

  function update(dt) {
    elapsed += dt;
    if (paused || state.over) return;
    if (heldDirection) moveShip(state, heldDirection, dt);
    if (firing) fireImpact(state);
    const { destroyed, hit, collected, bossDown, shielded, bossSpawn } = stepImpact(state, dt);
    if (destroyed) beep(true, 780, 0.05);
    if (hit) beep(true, 180, 0.16);
    if (shielded) beep(true, 520, 0.12);
    if (collected.length) beep(true, collected.includes('repair') ? 980 : 660, 0.09);
    if (bossSpawn) beep(true, 240, 0.2);
    if (bossDown) beep(true, 120, 0.3);
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    if (state.over && !ended) {
      ended = true;
      showOverlay(overlay, {
        kicker: 'SHIP LOST', title: 'Game over.', copy: `Score ${state.score} · wave ${state.level}. Opnieuw?`, action: 'OPNIEUW ▶', onAction: start
      });
    }
    sync();
  }

  function fill(x, y, w, h, color = '#0f380f') {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL, y * CELL, w * CELL, h * CELL);
  }

  function pixels(x, y, coords) {
    for (const [px, py] of coords) fill(x + px, y + py, 1, 1);
  }

  const PICKUP_PIXELS = {
    weapon: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    shield: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    repair: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
  };

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(48, 98, 15, .3)';
    for (const star of STARS) {
      if ((star.x + Math.floor(elapsed * 3)) % 11 === 0) continue;
      ctx.fillRect(star.x * CELL + 4, star.y * CELL + 4, 2, 2);
    }
    ctx.fillStyle = 'rgba(48, 98, 15, .25)';
    for (let x = 0; x < FIELD_W; x += 2) ctx.fillRect(x * CELL, H - 6, CELL, 2);

    for (const bullet of state.bullets) {
      fill(Math.floor(bullet.x), Math.floor(bullet.y), Math.ceil(bullet.w), 1);
    }
    for (const enemy of state.enemies) {
      const size = enemySize(enemy);
      const x = Math.floor(enemy.x);
      const y = Math.floor(enemy.y);
      fill(x, y, size.w, size.h);
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect((x + 1) * CELL, (y + 1) * CELL, CELL, CELL);
      if (enemy.type === 'heavy') ctx.fillRect((x + 2) * CELL, (y + 1) * CELL, CELL, CELL);
      if (enemy.type === 'boss') {
        ctx.fillRect((x + 3) * CELL, (y + 1) * CELL, CELL, CELL);
        ctx.fillRect((x + 1) * CELL, (y + 3) * CELL, CELL, CELL);
        ctx.fillRect((x + 5) * CELL, (y + 3) * CELL, CELL, CELL);
        const barY = Math.max(0, y - 1);
        const ratio = Math.max(0, Math.min(1, enemy.hp / (enemy.maxHp || size.hp)));
        fill(x, barY, size.w, 1);
        ctx.fillStyle = '#9bbc0f';
        ctx.fillRect((x + 1) * CELL + 1, barY * CELL + 2, (size.w - 2) * CELL - 2, CELL - 4);
        ctx.fillStyle = '#0f380f';
        ctx.fillRect((x + 1) * CELL + 2, barY * CELL + 3, ((size.w - 2) * CELL - 4) * ratio, CELL - 6);
      }
    }
    for (const pickup of state.pickups) {
      const x = Math.floor(pickup.x);
      const y = Math.floor(pickup.y);
      pixels(x, y, PICKUP_PIXELS[pickup.type] || PICKUP_PIXELS.repair);
    }
    if (!state.over && (state.invuln <= 0 || Math.floor(elapsed * 12) % 2 === 0)) {
      const x = state.ship.x;
      const y = Math.floor(state.ship.y);
      fill(x, y + 1, 2, 1);
      fill(x + 1, y, 1, 3);
      fill(x + 2, y + 1, 2, 1);
      fill(x + 4, y + 1, 1, 1);
    }
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(15, 56, 15, ${Math.min(0.55, state.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  const stopSwipe = onSwipe(canvas, (direction) => {
    if (direction === 'up' || direction === 'down') input(direction);
    else input('fire');
  });
  const stopButtons = bindButtons(controls, {
    '[data-action="pause"]': togglePause
  });

  const cleanups = [];
  function hold(button, onDown, onUp) {
    if (!button) return;
    const down = (event) => { event.preventDefault(); onDown(); };
    const up = () => onUp();
    button.addEventListener('pointerdown', down);
    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(event, up);
    cleanups.push(() => {
      button.removeEventListener('pointerdown', down);
      for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.removeEventListener(event, up);
    });
  }
  hold(controls.querySelector('[data-action="up"]'),
    () => { heldDirection = 'up'; input('up'); },
    () => { if (heldDirection === 'up') heldDirection = null; });
  hold(controls.querySelector('[data-action="down"]'),
    () => { heldDirection = 'down'; input('down'); },
    () => { if (heldDirection === 'down') heldDirection = null; });
  hold(controls.querySelector('[data-action="fire"]'),
    () => { firing = true; input('fire'); },
    () => { firing = false; });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'NOKIA · 2002', title: 'SPACE IMPACT', copy: 'Schiet de indringers neer. Bescherm je schip.', action: 'START ▶', onAction: start
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
