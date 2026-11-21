import { ATTRACTIONS, COSTS, H, RIDE_TYPES, REPAIR_COST, W, index, newPark, parkScore, place, repairAll, stepPark } from './coaster-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 30;
const CW = W * CELL;
const CH = H * CELL;
const BEST_KEY = 'defaultstackr-nokia-coaster-best';
const SPEEDS = [1, 2, 3];
const TOOLS = ['path', ...RIDE_TYPES, 'shop', 'tree', 'demolish'];
const LABELS = { path: 'PAD', shop: 'SHOP', tree: 'BOOM', demolish: 'SLOPEN' };

const toolLabel = (tool) => ATTRACTIONS[tool]?.label || LABELS[tool] || tool.toUpperCase();
const money = (value) => {
  const amount = Math.round(value);
  return `${amount < 0 ? '-' : ''}${String(Math.abs(amount)).padStart(4, '0')}`;
};

export function mountCoaster({ canvas, overlay, scoreNode, bestNode, statusNode, balanceNode, controls }) {
  const ctx = createCanvas(canvas, CW, CH);
  const buildSelect = controls.querySelector('#build-select');
  const speedNode = controls.querySelector('[data-action="speed"] b');
  let state = newPark();
  let best = getBest(BEST_KEY);
  let tool = 'path';
  let cursor = index(Math.floor(W / 2), Math.floor(H / 2));
  let speedIndex = 0;
  let paused = false;
  let ended = false;
  let message = 'BOUW je park';
  let messageTimer = 2;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(parkScore(state)).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    if (balanceNode) {
      balanceNode.textContent = money(state.cash);
      balanceNode.classList.toggle('low', state.cash < 100);
    }
    statusNode.textContent = state.over
      ? (state.won ? 'DOEL BEHAALD' : 'FAILLIET')
      : paused ? 'PAUSED' : `DAG ${state.day} · ${state.guests.length} G · ★${state.rating}`;
  }

  function setTool(next) {
    if (!TOOLS.includes(next)) return;
    tool = next;
    controls.querySelectorAll('.tool-key').forEach((button) => {
      button.classList.toggle('active', button.dataset.action === `tool:${next}`);
    });
    // Demolish is a separate button, so keep the last build choice selected.
    if (buildSelect && next !== 'demolish') buildSelect.value = next;
    sync();
  }

  function setSpeed(nextIndex) {
    speedIndex = nextIndex % SPEEDS.length;
    if (speedNode) speedNode.textContent = `»${SPEEDS[speedIndex]}`;
    beep(true, 520, 0.04);
    sync();
  }

  function start() {
    state = newPark();
    cursor = index(Math.floor(W / 2), Math.floor(H / 2));
    speedIndex = 0;
    if (speedNode) speedNode.textContent = `»${SPEEDS[0]}`;
    paused = false;
    ended = false;
    message = 'BOUW je park';
    messageTimer = 2;
    setTool('path');
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) showOverlay(overlay, {
      kicker: 'PARK GESLOTEN', title: 'Even stil.', copy: 'De gasten wachten.', action: 'VERDER ▶', onAction: togglePause
    });
    else hideOverlay(overlay);
    sync();
  }

  function notify(ok, text) {
    beep(true, ok ? 700 : 180, ok ? 0.05 : 0.08);
    message = text;
    messageTimer = 1.6;
    sync();
  }

  function build() {
    if (paused || state.over) return;
    const x = cursor % W;
    const y = Math.floor(cursor / W);
    const result = place(state, x, y, tool);
    if (result.ok) {
      notify(true, tool === 'demolish' ? 'GESLOOPT' : `${toolLabel(tool)} · -€${result.cost ?? 0}`);
    } else {
      notify(false, result.reason);
    }
  }

  function doRepair() {
    if (paused || state.over) return;
    const result = repairAll(state);
    if (result.ok) notify(true, `${result.count} GEREPT · -€${result.cost}`);
    else notify(false, result.reason);
  }

  function move(direction) {
    const x = cursor % W;
    const y = Math.floor(cursor / W);
    const next = direction === 'left' ? [x - 1, y] : direction === 'right' ? [x + 1, y]
      : direction === 'up' ? [x, y - 1] : [x, y + 1];
    if (next[0] < 0 || next[0] >= W || next[1] < 0 || next[1] >= H) return;
    cursor = index(next[0], next[1]);
  }

  function input(action) {
    if (action === 'pause') { togglePause(); return; }
    if (action === 'start') { start(); return; }
    if (action.startsWith('tool:')) { setTool(action.slice(5)); return; }
    if (action === 'ride:next') {
      const current = RIDE_TYPES.indexOf(tool);
      setTool(RIDE_TYPES[(current + 1) % RIDE_TYPES.length]);
      return;
    }
    if (action === 'speed') { setSpeed(speedIndex + 1); return; }
    if (action === 'repair') { doRepair(); return; }
    if (paused || state.over) return;
    if (['up', 'down', 'left', 'right'].includes(action)) move(action);
    else if (action === 'fire' || action === 'select') build();
  }

  function update(dt) {
    if (!paused && !state.over) stepPark(state, dt * SPEEDS[speedIndex]);
    if (messageTimer > 0) messageTimer = Math.max(0, messageTimer - dt);
    const score = parkScore(state);
    if (score > best) best = setBest(BEST_KEY, score, best);
    if (state.over && !ended) {
      ended = true;
      showOverlay(overlay, {
        kicker: state.won ? 'PARK VOLTOOID' : 'PARK GESLOTEN',
        title: state.won ? 'Gefeliciteerd!' : 'Game over.',
        copy: state.won
          ? `Dag ${state.day} · rating ${state.rating} · €${Math.round(state.cash)}.`
          : `Het geld is op. Score ${score}.`,
        action: 'OPNIEUW ▶',
        onAction: start
      });
    }
    sync();
  }

  function fill(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL, y * CELL, w * CELL, h * CELL);
  }

  function drawObject(object) {
    const x = object.x * CELL;
    const y = object.y * CELL;
    const ink = object.broken ? '#7a8f1a' : '#9bbc0f';
    fill(object.x, object.y, 1, 1, '#0f380f');
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;

    if (object.type === 'coaster') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2 - 2, CELL / 2 - 5, Math.PI, Math.PI * 2.6);
      ctx.stroke();
      ctx.fillRect(x + 5, y + CELL - 7, 4, 4);
      ctx.fillRect(x + CELL - 9, y + CELL - 7, 4, 4);
    } else if (object.type === 'ferris') {
      ctx.lineWidth = 2;
      const r = CELL / 2 - 5;
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      for (let a = 0; a < 4; a += 1) {
        const angle = a * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + CELL / 2 - Math.cos(angle) * r, y + CELL / 2 - Math.sin(angle) * r);
        ctx.lineTo(x + CELL / 2 + Math.cos(angle) * r, y + CELL / 2 + Math.sin(angle) * r);
        ctx.stroke();
      }
    } else if (object.type === 'carousel') {
      ctx.fillRect(x + 4, y + 7, CELL - 8, 3);
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 10);
      ctx.lineTo(x + CELL / 2, y + 3);
      ctx.lineTo(x + CELL - 2, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x + 6, y + 13, 3, 6);
      ctx.fillRect(x + CELL - 9, y + 13, 3, 6);
    } else if (object.type === 'shop') {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 10);
      ctx.lineTo(x + CELL / 2, y + 3);
      ctx.lineTo(x + CELL - 3, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x + 6, y + 13, CELL - 12, 3);
    } else {
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2 - 2, CELL / 2 - 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, CW, CH);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const at = index(x, y);
        if (state.tiles[at] === 'path') {
          fill(x, y, 1, 1, '#8bac0f');
          ctx.strokeStyle = '#306230';
          ctx.lineWidth = 1;
          ctx.strokeRect(x * CELL + 2.5, y * CELL + 2.5, CELL - 5, CELL - 5);
        } else if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(48,98,15,.08)';
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }
    state.objects.forEach(drawObject);
    for (const guest of state.guests) {
      ctx.fillStyle = guest.state === 'riding' ? '#306230' : '#0f380f';
      ctx.fillRect(guest.x * CELL + CELL / 2 - 2, guest.y * CELL + 3, 4, 4);
    }
    if (!paused && !state.over) {
      ctx.strokeStyle = Math.floor(performance.now() / 350) % 2 ? '#0f380f' : '#306230';
      ctx.lineWidth = 2;
      const x = cursor % W;
      const y = Math.floor(cursor / W);
      ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.fillStyle = '#0f380f';
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`${toolLabel(tool)} €${COSTS[tool] ?? 0}`, 3, 2);
    ctx.textAlign = 'right';
    ctx.fillText(`€${Math.round(state.cash)}`, CW - 3, 2);
    ctx.textAlign = 'left';
    if (messageTimer > 0) {
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect(0, CH - 12, CW, 12);
      ctx.fillStyle = '#0f380f';
      ctx.fillText(message, 3, CH - 10);
    }
  }

  const stopSwipe = onSwipe(canvas, (direction) => {
    if (['left', 'right', 'up', 'down'].includes(direction)) move(direction);
  });
  const tap = (event) => {
    if (paused || state.over) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * W);
    const y = Math.floor((event.clientY - rect.top) / rect.height * H);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    event.preventDefault();
    cursor = index(x, y);
    build();
  };
  canvas.addEventListener('pointerdown', tap);
  const onBuildChange = () => { if (buildSelect) setTool(buildSelect.value); };
  buildSelect?.addEventListener('change', onBuildChange);
  const stopButtons = bindButtons(controls, {
    '[data-action="pause"]': togglePause,
    '[data-action="fire"]': build,
    '[data-action="select"]': build,
    '[data-action="speed"]': () => setSpeed(speedIndex + 1),
    '[data-action="repair"]': doRepair,
    '[data-action="tool:path"]': () => setTool('path'),
    '[data-action="tool:shop"]': () => setTool('shop'),
    '[data-action="tool:tree"]': () => setTool('tree'),
    '[data-action="tool:demolish"]': () => setTool('demolish')
  });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'NOKIA · 2003', title: 'COASTER PARK',
    copy: `Kies in BOUW, tik op het veld en bereik rating 60 en €1000 op dag 3. Reparatie: €${REPAIR_COST} per rit.`,
    action: 'START ▶', onAction: start
  });

  return {
    start,
    input,
    destroy() {
      loop.stop();
      stopSwipe();
      canvas.removeEventListener('pointerdown', tap);
      buildSelect?.removeEventListener('change', onBuildChange);
      stopButtons();
    }
  };
}
