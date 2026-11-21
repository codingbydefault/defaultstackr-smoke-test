import { getBest } from './engine.mjs';
import { mountBounce } from './bounce-game.js';
import { mountCoaster } from './coaster-park-game.js';
import { mountImpact } from './impact-game.js';
import { mountLines } from './lines-game.js';
import { mountPairs } from './pairs-game.js';
import { mountSnake } from './snake-game.js';
import { mountSpaceTetris } from './space-tetris-game.js';
import { mountTrap } from './trap-game.js';

const GAMES = {
  snake: {
    title: 'SNAKE',
    kicker: 'NOKIA 3310 · 1998',
    hint: 'Swipe of pijltjes om te sturen',
    controls: 'controls-snake',
    bestKey: 'defaultstackr-nokia-snake-best',
    pad: 3,
    mount: mountSnake
  },
  tetris: {
    title: 'SPACE TETRIS',
    kicker: 'NOKIA · 2000',
    hint: 'Swipe om te verplaatsen · omhoog = draaien',
    controls: 'controls-tetris',
    bestKey: 'defaultstackr-nokia-space-tetris-best',
    pad: 5,
    mount: mountSpaceTetris
  },
  impact: {
    title: 'SPACE IMPACT',
    kicker: 'NOKIA · 2002',
    hint: 'Swipe om te bewegen · tik = vuren',
    controls: 'controls-impact',
    bestKey: 'defaultstackr-nokia-impact-best',
    pad: 5,
    mount: mountImpact
  },
  bounce: {
    title: 'BOUNCE',
    kicker: 'NOKIA · 2001',
    hint: 'Houd de bal in de lucht met ◀ ▶',
    controls: 'controls-bounce',
    bestKey: 'defaultstackr-nokia-bounce-best',
    pad: 5,
    mount: mountBounce
  },
  pairs: {
    title: 'PAIRS',
    kicker: 'NOKIA · 1999',
    hint: 'Tik twee kaarten aan · zoek de paren',
    controls: 'controls-pairs',
    bestKey: 'defaultstackr-nokia-pairs-best',
    pad: 3,
    mount: mountPairs
  },
  lines: {
    title: 'LINES 96',
    kicker: 'NOKIA · 1996',
    hint: 'Tik een bal, tik een vak · vijf van een kleur',
    controls: 'controls-lines',
    bestKey: 'defaultstackr-nokia-lines-best',
    pad: 5,
    mount: mountLines
  },
  trap: {
    title: 'TRAP!',
    kicker: 'NOKIA · 2000',
    hint: 'Ontwijk de vallen met ◀ ▶ ▲ ▼',
    controls: 'controls-trap',
    bestKey: 'defaultstackr-nokia-trap-best',
    pad: 5,
    mount: mountTrap
  },
  coaster: {
    title: 'COASTER PARK',
    kicker: 'NOKIA · 2003',
    hint: 'Kies in BOUW · tik op het veld · R rit · S snelheid · F repareren',
    controls: 'controls-coaster',
    bestKey: 'defaultstackr-nokia-coaster-best',
    pad: 5,
    balance: true,
    compactKeypad: true,
    mount: mountCoaster
  }
};

const hub = document.querySelector('#hub');
const gameView = document.querySelector('#game-view');
const canvas = document.querySelector('#game-canvas');
const overlay = document.querySelector('#game-overlay');
const scoreNode = document.querySelector('#score');
const bestNode = document.querySelector('#best');
const statusNode = document.querySelector('#status');
const balanceNode = document.querySelector('#balance');
const balanceWrap = document.querySelector('#balance-wrap');
const titleNode = document.querySelector('#game-title');
const kickerNode = document.querySelector('#game-kicker');
const hintNode = document.querySelector('#game-hint');
const exitButton = document.querySelector('#exit');

for (const [id, game] of Object.entries(GAMES)) {
  const node = document.querySelector(`#card-best-${id}`);
  if (node) node.textContent = String(getBest(game.bestKey)).padStart(game.pad, '0');
}

let active = null;
let current = null;

function close() {
  if (active) { active.destroy(); active = null; }
  current = null;
  gameView.hidden = true;
  hub.hidden = false;
  gameView.classList.remove('compact-keypad');
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
  scoreNode.textContent = '0'.repeat(game.pad);
  bestNode.textContent = String(getBest(game.bestKey)).padStart(game.pad, '0');
  statusNode.textContent = 'READY';
  balanceWrap.hidden = !game.balance;
  gameView.classList.toggle('compact-keypad', Boolean(game.compactKeypad));

  document.querySelectorAll('[data-controls]').forEach((group) => {
    group.hidden = group.dataset.controls !== game.controls;
  });
  hub.hidden = true;
  gameView.hidden = false;
  document.body.classList.add('playing');
  history.replaceState(null, '', `#${id}`);

  active = game.mount({ canvas, overlay, scoreNode, bestNode, statusNode, balanceNode, controls: document.getElementById(game.controls) });
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
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  '1': 'tool:path', '2': 'tool:shop', '3': 'tool:tree', '4': 'tool:demolish',
  r: 'ride:next', s: 'speed', f: 'repair'
};
document.addEventListener('keydown', (event) => {
  if (!active) return;
  // Let a focused dropdown keep its own keyboard behaviour.
  if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const action = KEY_ACTIONS[key];
  if (action) {
    event.preventDefault();
    active.input(action);
  } else if (event.code === 'Space') {
    event.preventDefault();
    active.input(current === 'impact' ? 'fire' : current === 'lines' ? 'select' : 'start');
  } else if (event.key === 'Enter') {
    event.preventDefault();
    active.input(current === 'lines' ? 'select' : 'start');
  } else if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    active.input('pause');
  }
});

const initial = location.hash.slice(1);
if (GAMES[initial]) launch(initial);
else close();
