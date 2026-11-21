import { COLS, ROWS, SHAPES, ghostY, hardDrop, holdPiece, movePiece, newTetris, rotatePiece, softDrop, stepTetris } from './space-tetris-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const CELL = 12;
const W = COLS * CELL;
const H = ROWS * CELL;
const BEST_KEY = 'defaultstackr-nokia-space-tetris-best';
const STARS = Array.from({ length: 24 }, (_, i) => ({ x: (i * 7 + 3) % COLS, y: (i * 11 + 5) % ROWS }));

export function mountSpaceTetris({ canvas, overlay, scoreNode, bestNode, statusNode, controls }) {
  const ctx = createCanvas(canvas, W, H);
  let state = newTetris();
  let best = getBest(BEST_KEY);
  let paused = false;
  let ended = false;
  let elapsed = 0;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(state.score).padStart(5, '0');
    bestNode.textContent = String(best).padStart(5, '0');
    const hold = state.hold ? ` · HOLD ${state.hold}` : '';
    const combo = state.combo > 0 ? ` · COMBO x${state.combo + 1}` : '';
    statusNode.textContent = state.over ? 'GAME OVER' : paused ? 'PAUSED' : `LEVEL ${state.level} · ${state.lines} LINES${hold}${combo}`;
  }

  function start() {
    state = newTetris();
    paused = false;
    ended = false;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) {
      showOverlay(overlay, {
        kicker: 'ORBIT PAUSED', title: 'Even stil.', copy: 'De satellieten wachten.', action: 'VERDER ▶', onAction: togglePause
      });
    } else hideOverlay(overlay);
    sync();
  }

  function input(action) {
    if (action === 'pause') { togglePause(); return; }
    if (action === 'start') { start(); return; }
    if (paused || state.over) return;
    if (action === 'left') movePiece(state, -1);
    else if (action === 'right') movePiece(state, 1);
    else if (action === 'rotate') rotatePiece(state);
    else if (action === 'rotate-ccw') rotatePiece(state, -1);
    else if (action === 'hold') holdPiece(state);
    else if (action === 'soft') softDrop(state);
    else if (action === 'drop') {
      const cleared = hardDrop(state);
      if (cleared) beep(true, 720, 0.09);
    } else if (['up', 'down'].includes(action)) {
      if (action === 'up') rotatePiece(state);
      else softDrop(state);
    }
  }

  function update(dt) {
    elapsed += dt;
    if (paused || state.over) return;
    const { cleared } = stepTetris(state, dt);
    if (cleared) beep(true, 600 + cleared * 90, 0.08);
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    if (state.over && !ended) {
      ended = true;
      showOverlay(overlay, {
        kicker: 'SIGNAL LOST', title: 'Game over.', copy: `Score ${state.score} · ${state.lines} lijnen. Opnieuw?`, action: 'OPNIEUW ▶', onAction: start
      });
    }
    sync();
  }

  function cell(x, y, shade = '#0f380f') {
    ctx.fillStyle = shade;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function pieceCells(type, rotation, offsetX, offsetY, shade = '#0f380f') {
    for (const [cx, cy] of SHAPES[type][rotation]) {
      const x = offsetX + cx;
      const y = offsetY + cy;
      if (y >= 0) cell(x, y, shade);
    }
  }

  // A tiny LCD-style hold preview, drawn inside the existing canvas.
  function drawHold() {
    if (!state.hold) return;
    const cells = SHAPES[state.hold][0];
    const xs = cells.map(([cx]) => cx);
    const ys = cells.map(([, cy]) => cy);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const x0 = COLS - 5;
    const y0 = 1;
    const dx = x0 + Math.floor((4 - (maxX - minX + 1)) / 2) - minX;
    const dy = y0 + Math.floor((4 - (maxY - minY + 1)) / 2) - minY;
    ctx.fillStyle = 'rgba(15, 56, 15, .14)';
    ctx.fillRect(x0 * CELL, y0 * CELL, 4 * CELL, 4 * CELL);
    ctx.strokeStyle = 'rgba(15, 56, 15, .45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 * CELL + 0.5, y0 * CELL + 0.5, 4 * CELL - 1, 4 * CELL - 1);
    pieceCells(state.hold, 0, dx, dy, 'rgba(15, 56, 15, .65)');
  }

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(48, 98, 15, .22)';
    for (const star of STARS) {
      if ((star.y + Math.floor(elapsed * 2)) % 7 === 0) continue;
      ctx.fillRect(star.x * CELL + 5, star.y * CELL + 5, 2, 2);
    }
    ctx.fillStyle = 'rgba(48, 98, 15, .12)';
    for (let x = 1; x < COLS; x += 1) ctx.fillRect(x * CELL, 0, 1, H);
    for (let y = 1; y < ROWS; y += 1) ctx.fillRect(0, y * CELL, W, 1);

    state.board.forEach((row, y) => {
      row.forEach((type, x) => { if (type) cell(x, y, '#306230'); });
    });
    drawHold();
    const ghost = ghostY(state);
    if (ghost !== state.piece.y) {
      // Translucent fill + darker outline: the landing spot stays readable.
      ctx.fillStyle = 'rgba(15, 56, 15, .10)';
      ctx.strokeStyle = 'rgba(15, 56, 15, .55)';
      ctx.lineWidth = 2;
      for (const [cx, cy] of SHAPES[state.piece.type][state.piece.rot]) {
        const gx = (state.piece.x + cx) * CELL + 2;
        const gy = (ghost + cy) * CELL + 2;
        ctx.fillRect(gx, gy, CELL - 4, CELL - 4);
        ctx.strokeRect(gx, gy, CELL - 4, CELL - 4);
      }
    }
    pieceCells(state.piece.type, state.piece.rot, state.piece.x, state.piece.y);
  }

  // Extra keys live here so the shared hub keyboard map stays untouched.
  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'c') { event.preventDefault(); input('hold'); }
    else if (key === 'z') { event.preventDefault(); input('rotate-ccw'); }
  }
  document.addEventListener('keydown', onKeyDown);

  const stopSwipe = onSwipe(canvas, (direction) => {
    input(direction === 'left' || direction === 'right' ? direction : 'drop');
  });
  const stopButtons = bindButtons(controls, {
    '[data-action="left"]': () => input('left'),
    '[data-action="right"]': () => input('right'),
    '[data-action="rotate"]': () => input('rotate'),
    '[data-action="soft"]': () => input('soft'),
    '[data-action="drop"]': () => input('drop'),
    '[data-action="pause"]': togglePause
  });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'RETRO LCD · 2000', title: 'SPACE TETRIS', copy: 'Stapel satellieten. Vul een rij om die te laten verdwijnen.', action: 'START ▶', onAction: start
  });

  return {
    start,
    input,
    destroy() {
      loop.stop();
      stopSwipe();
      stopButtons();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
}
