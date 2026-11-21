import { newLines, selectCell, SIZE } from './lines-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 30;
const W = SIZE * CELL;
const COLORS = ['#0f380f', '#306230', '#8bac0f', '#0f380f', '#4a7a1a', '#234f12', '#6d9c1a'];
const BEST_KEY = 'defaultstackr-nokia-lines-best';

export function mountLines({ canvas, overlay, scoreNode, bestNode, statusNode, controls }) {
  const ctx = createCanvas(canvas, W, W);
  let state = newLines();
  let best = getBest(BEST_KEY);
  let cursor = Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2);
  let paused = false;
  let ended = false;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(state.score).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    statusNode.textContent = state.over ? 'FULL' : paused ? 'PAUSED' : state.selected === null ? 'KIES BAL' : 'KIES VAK';
  }

  function start() {
    state = newLines();
    cursor = Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2);
    paused = false;
    ended = false;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) showOverlay(overlay, {
      kicker: 'GAME PAUSED', title: 'Even stil.', copy: 'De ballen wachten.', action: 'VERDER ▶', onAction: togglePause
    });
    else hideOverlay(overlay);
    sync();
  }

  function choose(target) {
    if (paused || state.over) return;
    const result = selectCell(state, target);
    if (result.type === 'select') beep(true, 620, 0.05);
    else if (result.type === 'move') {
      beep(true, 820, 0.06);
      if (result.cleared.length >= 5) beep(true, 980, 0.12);
    } else if (result.type === 'blocked') beep(true, 180, 0.08);
    if (state.over && !ended) {
      ended = true;
      showOverlay(overlay, {
        kicker: 'BOARD FULL', title: 'Game over.', copy: `Score ${state.score}. Opnieuw?`, action: 'OPNIEUW ▶', onAction: start
      });
    }
    sync();
  }

  function moveCursor(direction) {
    const x = cursor % SIZE;
    const y = Math.floor(cursor / SIZE);
    const next = direction === 'left' ? [x - 1, y] : direction === 'right' ? [x + 1, y]
      : direction === 'up' ? [x, y - 1] : [x, y + 1];
    if (next[0] < 0 || next[0] >= SIZE || next[1] < 0 || next[1] >= SIZE) return;
    cursor = next[1] * SIZE + next[0];
  }

  function input(action) {
    if (action === 'pause') { togglePause(); return; }
    if (action === 'start') { start(); return; }
    if (paused || state.over) return;
    if (['up', 'down', 'left', 'right'].includes(action)) moveCursor(action);
    else if (action === 'fire' || action === 'select') choose(cursor);
  }

  function update() {
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    sync();
  }

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#8bac0f';
    ctx.lineWidth = 1;
    for (let i = 1; i < SIZE; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, W);
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(W, i * CELL + 0.5);
      ctx.stroke();
    }
    if (!paused && !state.over) {
      ctx.strokeStyle = '#306230';
      ctx.lineWidth = 2;
      ctx.strokeRect((cursor % SIZE) * CELL + 2, Math.floor(cursor / SIZE) * CELL + 2, CELL - 4, CELL - 4);
    }
    state.board.forEach((ball, index) => {
      if (!ball) return;
      const x = (index % SIZE) * CELL;
      const y = Math.floor(index / SIZE) * CELL;
      ctx.fillStyle = COLORS[ball.color % COLORS.length];
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      if (index === state.selected) {
        ctx.strokeStyle = '#9bbc0f';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  const pointer = (event) => {
    if (paused || state.over) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * SIZE);
    const y = Math.floor((event.clientY - rect.top) / rect.height * SIZE);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    event.preventDefault();
    cursor = y * SIZE + x;
    choose(cursor);
  };
  canvas.addEventListener('pointerdown', pointer);

  const stopSwipe = onSwipe(canvas, (direction) => {
    if (['left', 'right', 'up', 'down'].includes(direction)) moveCursor(direction);
  });
  const stopButtons = bindButtons(controls, {
    '[data-action="pause"]': togglePause,
    '[data-action="select"]': () => choose(cursor)
  });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'NOKIA · 1996', title: 'LINES 96', copy: 'Verplaats een bal naar vrije vakken en maak vijf van een kleur.', action: 'START ▶', onAction: start
  });

  return {
    start,
    input,
    destroy() {
      loop.stop();
      canvas.removeEventListener('pointerdown', pointer);
      stopSwipe();
      stopButtons();
    }
  };
}
