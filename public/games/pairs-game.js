import { flipCard, finishPairs, hideMismatch, newPairs } from './pairs-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, setBest, showOverlay } from './engine.mjs';

const CELL = 60;
const CARD = 56;
const SIZE = CELL * 4;
const GLYPHS = ['◆', '■', '▲', '●', '✚', '✦', '◈', '☾'];
const BEST_KEY = 'defaultstackr-nokia-pairs-best';

export function mountPairs({ canvas, overlay, scoreNode, bestNode, statusNode, controls, onRunStart, onRunEnd }) {
  const ctx = createCanvas(canvas, SIZE, SIZE);
  let state = newPairs();
  let best = getBest(BEST_KEY);
  let paused = false;
  let ended = false;
  let mismatchTimer = null;
  let elapsed = 0;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(state.score).padStart(3, '0');
    bestNode.textContent = String(best).padStart(3, '0');
    statusNode.textContent = state.over ? 'COMPLEET' : paused ? 'PAUSED' : `${state.matches}/8 PAREN · ${state.moves} BEURTEN`;
  }

  function start() {
    if (mismatchTimer) clearTimeout(mismatchTimer);
    mismatchTimer = null;
    state = newPairs();
    paused = false;
    ended = false;
    onRunStart?.();
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (state.over) return;
    paused = !paused;
    if (paused) {
      showOverlay(overlay, {
        kicker: 'GAME PAUSED', title: 'Even stil.', copy: 'De kaarten wachten.', action: 'VERDER ▶', onAction: togglePause
      });
    } else hideOverlay(overlay);
    sync();
  }

  function flip(index) {
    if (paused || state.over) return;
    const result = flipCard(state, index);
    if (!result.changed) return;
    if (result.match) {
      beep(true, 700, 0.06);
      if (result.complete && !ended) {
        ended = true;
        onRunEnd?.(state.score);
        finishPairs(state);
        showOverlay(overlay, {
          kicker: 'PERFECT RUN', title: 'Alles gevonden!', copy: `Score ${state.score} in ${state.moves} beurten.`, action: 'OPNIEUW ▶', onAction: start
        });
      }
    } else if (result.match === false) {
      beep(true, 220, 0.08);
      mismatchTimer = setTimeout(() => {
        hideMismatch(state);
        mismatchTimer = null;
      }, 750);
    }
    sync();
  }

  function input(action) {
    if (action === 'pause') togglePause();
    else if (action === 'start') start();
  }

  function update(dt) {
    elapsed += dt;
    if (state.score > best) best = setBest(BEST_KEY, state.score, best);
    sync();
  }

  function drawCard(card, x, y) {
    const shown = card.flipped || card.matched;
    ctx.fillStyle = shown ? '#9bbc0f' : '#0f380f';
    ctx.fillRect(x + 2, y + 2, CARD - 4, CARD - 4);
    ctx.strokeStyle = '#306230';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2.5, y + 2.5, CARD - 5, CARD - 5);
    if (!shown) {
      ctx.fillStyle = '#8bac0f';
      ctx.fillRect(x + 16, y + 16, CARD - 32, CARD - 32);
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(x + 24, y + 24, CARD - 48, CARD - 48);
      return;
    }
    ctx.fillStyle = card.matched ? '#306230' : '#0f380f';
    ctx.font = 'bold 30px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(GLYPHS[card.symbol] || '?', x + CARD / 2, y + CARD / 2 + 1);
    if (card.matched && Math.floor(elapsed * 2) % 2 === 0) {
      ctx.fillRect(x + 6, y + 6, 6, 6);
    }
  }

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    state.cards.forEach((card, index) => {
      drawCard(card, (index % 4) * CELL, Math.floor(index / 4) * CELL);
    });
  }

  const pointer = (event) => {
    if (paused || state.over) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * SIZE;
    const y = (event.clientY - rect.top) / rect.height * SIZE;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    if (col < 0 || col > 3 || row < 0 || row > 3) return;
    event.preventDefault();
    flip(row * 4 + col);
  };
  canvas.addEventListener('pointerdown', pointer);

  const stopButtons = bindButtons(controls, {
    '[data-action="pause"]': togglePause,
    '[data-action="start"]': start
  });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'RETRO LCD · 1999', title: 'PAIRS', copy: 'Draai twee kaarten om en zoek de acht paren.', action: 'START ▶', onAction: start
  });

  return {
    start,
    input,
    destroy() {
      loop.stop();
      canvas.removeEventListener('pointerdown', pointer);
      stopButtons();
      if (mismatchTimer) clearTimeout(mismatchTimer);
    }
  };
}
