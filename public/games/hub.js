import { getBest } from './engine.mjs';
import { mountImpact } from './impact-game.js';
import { mountSnake } from './snake-game.js';
import { mountSpaceTetris } from './space-tetris-game.js';

const GAMES = {
  snake: {
    title: 'SNAKE',
    kicker: 'NOKIA 3310 · 1998',
    hint: 'Swipe of pijltjes om te sturen',
    controls: 'controls-snake',
    bestKey: 'defaultstackr-nokia-snake-best',
    mount: mountSnake
  },
  tetris: {
    title: 'SPACE TETRIS',
    kicker: 'NOKIA · 2000',
    hint: 'Swipe om te verplaatsen · omhoog = draaien',
    controls: 'controls-tetris',
    bestKey: 'defaultstackr-nokia-space-tetris-best',
    mount: mountSpaceTetris
  },
  impact: {
    title: 'SPACE IMPACT',
    kicker: 'NOKIA · 2002',
    hint: 'Swipe om te bewegen · tik = vuren',
    controls: 'controls-impact',
    bestKey: 'defaultstackr-nokia-impact-best',
    mount: mountImpact
  }
};

const hub = document.querySelector('#hub');
const gameView = document.querySelector('#game-view');
const canvas = document.querySelector('#game-canvas');
const overlay = document.querySelector('#game-overlay');
const scoreNode = document.querySelector('#score');
const bestNode = document.querySelector('#best');
const statusNode = document.querySelector('#status');
const titleNode = document.querySelector('#game-title');
const kickerNode = document.querySelector('#game-kicker');
const hintNode = document.querySelector('#game-hint');
const exitButton = document.querySelector('#exit');

for (const [id, game] of Object.entries(GAMES)) {
  const node = document.querySelector(`#card-best-${id}`);
  if (node) node.textContent = String(getBest(game.bestKey)).padStart(id === 'snake' ? 3 : 5, '0');
}

let active = null;
let current = null;

function close() {
  if (active) { active.destroy(); active = null; }
  current = null;
  gameView.hidden = true;
  hub.hidden = false;
  document.body.classList.remove('playing');
  history.replaceState(null, '', '/');
  if (document.fullscreenElement) {
    try { document.exitFullscreen().catch(() => {}); } catch { /* Not supported. */ }
  }
}

function launch(id) {
  const game = GAMES[id];
  if (!game) return;
  if (active) { active.destroy(); active = null; }

  current = id;
  titleNode.textContent = game.title;
  kickerNode.textContent = game.kicker;
  hintNode.textContent = game.hint;
  scoreNode.textContent = '000';
  bestNode.textContent = String(getBest(game.bestKey)).padStart(game.title === 'SNAKE' ? 3 : 5, '0');
  statusNode.textContent = 'LAUNCHING';

  document.querySelectorAll('[data-controls]').forEach((group) => {
    group.hidden = group.dataset.controls !== game.controls;
  });
  hub.hidden = true;
  gameView.hidden = false;
  document.body.classList.add('playing');
  history.replaceState(null, '', `#${id}`);

  active = game.mount({ canvas, overlay, scoreNode, bestNode, statusNode, controls: document.getElementById(game.controls) });
  active.start();

  // The click is a user gesture, so browsers allow fullscreen here. The CSS
  // fallback still fills the screen when the API is unavailable or refused.
  try {
    const request = gameView.requestFullscreen?.();
    if (request?.catch) request.catch(() => {});
  } catch { /* Fallback layout is already full screen. */ }
}

document.querySelectorAll('[data-game]').forEach((card) => {
  card.addEventListener('click', () => launch(card.dataset.game));
});
exitButton.addEventListener('click', close);

const KEY_ACTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
};
document.addEventListener('keydown', (event) => {
  if (!active) return;
  const action = KEY_ACTIONS[event.key];
  if (action) {
    event.preventDefault();
    active.input(action);
  } else if (event.code === 'Space') {
    event.preventDefault();
    active.input(current === 'impact' ? 'fire' : 'start');
  } else if (event.key === 'Enter') {
    event.preventDefault();
    active.input('start');
  } else if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    active.input('pause');
  }
});

const initial = location.hash.slice(1);
if (GAMES[initial]) launch(initial);
else close();
