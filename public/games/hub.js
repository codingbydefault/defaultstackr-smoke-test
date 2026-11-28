import { getBest } from './engine.mjs';
import { createLeaderboardUI } from './leaderboard-ui.mjs';
import { mountBounce } from './bounce-game.js';
import { mountCoaster } from './coaster-park-game.js';
import { mountFrogger } from './frogger-game.js';
import { mountImpact } from './impact-game.js';
import { mountPairs } from './pairs-game.js';
import { mountRacer } from './racer-game.js';
import { mountSnake } from './snake-game.js';
import { mountSpaceTetris } from './space-tetris-game.js';
import { mountTrap } from './trap-game.js';

const GAMES = {
  snake: {
    title: 'SNAKE',
    kicker: 'RETRO LCD · 1998',
    hint: 'Swipe of pijltjes om te sturen',
    controls: 'controls-snake',
    bestKey: 'defaultstackr-nokia-snake-best',
    pad: 3,
    mount: mountSnake
  },
  tetris: {
    title: 'SPACE TETRIS',
    kicker: 'RETRO LCD · 2000',
    hint: 'Swipe om te verplaatsen · omhoog = draaien',
    controls: 'controls-tetris',
    bestKey: 'defaultstackr-nokia-space-tetris-best',
    pad: 5,
    mount: mountSpaceTetris
  },
  impact: {
    title: 'SPACE IMPACT',
    kicker: 'RETRO LCD · 2002',
    hint: 'Swipe om te bewegen · tik = vuren',
    controls: 'controls-impact',
    bestKey: 'defaultstackr-nokia-impact-best',
    pad: 5,
    mount: mountImpact
  },
  bounce: {
    title: 'BOUNCE',
    kicker: 'RETRO LCD · 2001',
    hint: 'Houd de bal in de lucht met ◀ ▶',
    controls: 'controls-bounce',
    bestKey: 'defaultstackr-nokia-bounce-best',
    pad: 5,
    mount: mountBounce
  },
  pairs: {
    title: 'PAIRS',
    kicker: 'RETRO LCD · 1999',
    hint: 'Tik twee kaarten aan · zoek de paren',
    controls: 'controls-pairs',
    bestKey: 'defaultstackr-nokia-pairs-best',
    pad: 3,
    mount: mountPairs
  },
  racer: {
    title: 'POLE POSITION',
    kicker: 'RETRO LCD · 2003',
    hint: 'Stuur met ◀ ▶ · tik FIRE voor boost',
    controls: 'controls-racer',
    bestKey: 'defaultstackr-nokia-racer-best',
    pad: 5,
    mount: mountRacer
  },
  trap: {
    title: 'TRAP!',
    kicker: 'RETRO LCD · 2000',
    hint: 'Ontwijk de vallen met ◀ ▶ ▲ ▼',
    controls: 'controls-trap',
    bestKey: 'defaultstackr-nokia-trap-best',
    pad: 5,
    mount: mountTrap
  },
  coaster: {
    title: 'COASTER PARK',
    kicker: 'RETRO LCD · 2003',
    hint: 'Kies in BOUW · tik op het veld · R draaien · S snelheid · F repareren',
    controls: 'controls-coaster',
    bestKey: 'defaultstackr-nokia-coaster-best',
    pad: 5,
    balance: true,
    compactKeypad: true,
    mount: mountCoaster
  },
  frogger: {
    title: 'FROGGER',
    kicker: 'RETRO LCD · 1997',
    hint: 'Oversteek de weg en de rivier naar het huis.',
    controls: 'controls-frogger',
    bestKey: 'defaultstackr-nokia-frogger-best',
    pad: 5,
    mount: mountFrogger
  }
};

const hub = document.querySelector('#hub');
const leaderboardUI = createLeaderboardUI(hub);
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

const heroConsole = document.querySelector('#hero-console');
const heroArt = document.querySelector('#hc-art');
const heroOverlay = document.querySelector('#hc-overlay');
const heroKicker = document.querySelector('#hc-kicker');
const heroTitle = document.querySelector('#hc-title');
const heroCopy = document.querySelector('#hc-copy');
const playerChipName = document.querySelector('#player-chip-name');
const playerChipSwitch = document.querySelector('#player-chip-switch');
const HERO_GAMES = Object.keys(GAMES);
let selected = 'snake';

function syncHero() {
  const id = HERO_GAMES.includes(selected) ? selected : HERO_GAMES[0];
  const game = GAMES[id];
  const source = document.querySelector(`.game-card[data-game="${id}"] .card-art`);
  if (heroArt) heroArt.replaceChildren(source ? source.cloneNode(true) : null);
  if (heroKicker) heroKicker.textContent = game.kicker;
  if (heroTitle) heroTitle.textContent = game.title;
  if (heroCopy) heroCopy.textContent = game.hint;
  if (heroOverlay) heroOverlay.hidden = false;
}

function selectGame(id) {
  selected = GAMES[id] ? id : HERO_GAMES[0];
  if (heroConsole) heroConsole.dataset.selected = selected;
  syncHero();
}

document.querySelector('#hero-console').addEventListener('click', (event) => {
  const action = event.target.closest('[data-hub-action]');
  if (!action) return;
  const value = action.dataset.hubAction;
  if (value === 'start') launch(selected);
  else if (value === 'next') selectGame(HERO_GAMES[(HERO_GAMES.indexOf(selected) + 1) % HERO_GAMES.length]);
  else if (value === 'prev') selectGame(HERO_GAMES[(HERO_GAMES.indexOf(selected) - 1 + HERO_GAMES.length) % HERO_GAMES.length]);
});

document.querySelectorAll('[data-game]').forEach((card) => {
  card.addEventListener('click', () => { selectGame(card.dataset.game); launch(card.dataset.game); });
  card.addEventListener('focus', () => selectGame(card.dataset.game));
  card.addEventListener('pointermove', () => selectGame(card.dataset.game));
});

document.querySelector('#hc-start').addEventListener('click', () => launch(selected));

if (playerChipSwitch) {
  playerChipSwitch.addEventListener('click', async () => {
    const token = await leaderboardUI.changePlayer();
    const name = token ? (localStorage.getItem('defaultstackr-arcade-player-nickname') || '') : null;
    if (playerChipName) playerChipName.textContent = name || '???';
  });
}

syncHero();

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

  const gameCode = { tetris: 'space_tetris', impact: 'space_impact', racer: 'pole_position', coaster: 'coaster_park' }[id] || id;
  let pendingSession = null;
  active = game.mount({ canvas, overlay, scoreNode, bestNode, statusNode, balanceNode, controls: document.getElementById(game.controls),
    onRunStart: () => { pendingSession = leaderboardUI.startRun(gameCode); },
    onRunEnd: (score) => { leaderboardUI.finishRun(pendingSession, score); }
  });
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
  r: 'rotate', s: 'speed', f: 'repair'
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
    active.input(current === 'impact' || current === 'racer' ? 'fire' : 'start');
  } else if (event.key === 'Enter') {
    event.preventDefault();
    active.input('start');
  } else if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    active.input('pause');
  }
});

const initial = location.hash.slice(1) === 'lines' ? 'racer' : location.hash.slice(1);
if (GAMES[initial]) launch(initial);
else close();

document.addEventListener('keydown', (event) => {
  if (active) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable="true"]')) return;
  if (target instanceof HTMLElement && target.tagName === 'BUTTON') return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const index = HERO_GAMES.indexOf(selected);
    if (event.key === 'ArrowDown') selectGame(HERO_GAMES[(index + 1) % HERO_GAMES.length]);
    else if (event.key === 'ArrowUp') selectGame(HERO_GAMES[(index - 1 + HERO_GAMES.length) % HERO_GAMES.length]);
    else if (event.key === 'Home') selectGame(HERO_GAMES[0]);
    else selectGame(HERO_GAMES[HERO_GAMES.length - 1]);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    launch(selected);
  }
});
