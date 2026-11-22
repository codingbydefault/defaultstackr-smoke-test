import { GRID, advance, newGame, turn } from '../game-core.mjs';
import { beep, bindButtons, createCanvas, createLoop, getBest, hideOverlay, onSwipe, setBest, showOverlay } from './engine.mjs';

const TILE = 12;
const SIZE = GRID * TILE;
const BEST_KEY = 'defaultstackr-nokia-snake-best';

export function mountSnake({ canvas, overlay, scoreNode, bestNode, statusNode, controls, onRunStart, onRunEnd }) {
  const ctx = createCanvas(canvas, SIZE, SIZE);
  let game = newGame();
  let best = getBest(BEST_KEY);
  let paused = false;
  let elapsed = 0;
  let accumulator = 0;
  let ended = false;

  const loop = createLoop(update, draw);

  function sync() {
    scoreNode.textContent = String(game.score).padStart(3, '0');
    bestNode.textContent = String(best).padStart(3, '0');
    statusNode.textContent = game.phase === 'over' ? 'SIGNAL LOST'
      : game.phase === 'won' ? 'PERFECT RUN'
        : paused ? 'PAUSED'
          : game.phase === 'running' ? 'SPEL ACTIEF' : 'READY';
  }

  function start() {
    game = { ...newGame(), phase: 'running' };
    paused = false;
    ended = false;
    onRunStart?.();
    accumulator = 0;
    hideOverlay(overlay);
    sync();
    loop.start();
  }

  function togglePause() {
    if (game.phase !== 'running') return;
    paused = !paused;
    if (paused) {
      showOverlay(overlay, {
        kicker: 'PAUSE', title: 'Even stil.', copy: 'Je slang wacht op je.', action: 'VERDER ▶', onAction: togglePause
      });
    } else {
      hideOverlay(overlay);
      accumulator = 0;
    }
    sync();
  }

  function steer(direction) {
    if (paused || game.phase !== 'running') return;
    game = turn(game, direction);
  }

  function input(action) {
    if (action === 'pause') togglePause();
    else if (action === 'start') start();
    else if (['up', 'down', 'left', 'right'].includes(action)) steer(action);
  }

  function update(dt) {
    elapsed += dt;
    if (paused || game.phase !== 'running') return;
    accumulator += dt;
    const interval = Math.max(0.085, 0.18 - game.score * 0.003);
    while (accumulator >= interval && game.phase === 'running') {
      accumulator -= interval;
      game = advance(game);
      if (game.score > best) {
        best = setBest(BEST_KEY, game.score, best);
        beep(true, 620, 0.05);
      }
      if ((game.phase === 'over' || game.phase === 'won') && !ended) {
        ended = true;
        onRunEnd?.(game.score);
        showOverlay(overlay, {
          kicker: game.phase === 'won' ? 'PERFECT RUN' : 'SIGNAL LOST',
          title: game.phase === 'won' ? 'Je hebt gewonnen!' : 'Game over.',
          copy: `Score ${game.score}. Nog een poging?`,
          action: 'OPNIEUW ▶',
          onAction: start
        });
      }
      sync();
    }
  }

  function draw() {
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(48, 98, 15, .14)';
    for (let i = 1; i < GRID; i += 1) {
      ctx.fillRect(i * TILE, 0, 1, SIZE);
      ctx.fillRect(0, i * TILE, SIZE, 1);
    }
    if (game.food && Math.floor(elapsed * 3) % 2 === 0) {
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(game.food.x * TILE + 2, game.food.y * TILE + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect(game.food.x * TILE + 5, game.food.y * TILE + 5, TILE - 10, TILE - 10);
    }
    game.snake.forEach((part, index) => {
      const x = part.x * TILE + 1;
      const y = part.y * TILE + 1;
      ctx.fillStyle = index === 0 ? '#0f380f' : index % 2 ? '#306230' : '#1d4d1d';
      ctx.fillRect(x, y, TILE - 2, TILE - 2);
      if (index === 0) {
        ctx.fillStyle = '#c8f76b';
        const horizontal = game.direction === 'left' || game.direction === 'right';
        ctx.fillRect(x + (game.direction === 'right' ? 7 : 3), y + (horizontal ? 3 : 7), 2, 2);
        ctx.fillRect(x + (game.direction === 'right' ? 7 : 3), y + (horizontal ? 7 : 3) + (horizontal ? 0 : 2), 2, 2);
      }
    });
  }

  const stopSwipe = onSwipe(canvas, steer);
  const stopButtons = bindButtons(controls, {
    '[data-action="up"]': () => steer('up'),
    '[data-action="down"]': () => steer('down'),
    '[data-action="left"]': () => steer('left'),
    '[data-action="right"]': () => steer('right'),
    '[data-action="pause"]': togglePause
  });

  sync();
  draw();
  showOverlay(overlay, {
    kicker: 'RETRO LCD · 1998', title: 'SNAKE', copy: 'Verzamel de energie. Raak de muur of jezelf niet.', action: 'START ▶', onAction: start
  });

  return {
    start,
    input,
    destroy() {
      loop.stop();
      stopSwipe();
      stopButtons();
    }
  };
}
