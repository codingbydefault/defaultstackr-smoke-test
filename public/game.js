import { GRID, advance, newGame, turn } from './game-core.mjs';

const canvas = document.querySelector('#board');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const pauseButton = document.querySelector('#pause');
const scoreNode = document.querySelector('#score');
const bestNode = document.querySelector('#best');
const statusNode = document.querySelector('#status');
const statusLight = document.querySelector('#status-light');
const TILE = canvas.width / GRID;
let game = newGame();
let paused = false;
let lastTick = 0;
let frame = 0;
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem('defaultstackr-snake-best')) || 0); } catch { /* Private browsing can block storage. */ }

function pad(value) { return String(value).padStart(3, '0'); }
function setBest(value) {
  if (value <= best) return;
  best = value;
  try { localStorage.setItem('defaultstackr-snake-best', String(best)); } catch { /* Score still works in memory. */ }
}
function showOverlay(kicker, title, copy, action) {
  document.querySelector('#overlay-kicker').textContent = kicker;
  document.querySelector('#overlay-title').textContent = title;
  document.querySelector('#overlay-copy').textContent = copy;
  startButton.firstChild.textContent = `${action} `;
  overlay.hidden = false;
}
function sync() {
  scoreNode.textContent = pad(game.score);
  bestNode.textContent = pad(best);
  const running = game.phase === 'running' && !paused;
  statusNode.textContent = game.phase === 'over' ? 'Game over' : game.phase === 'won' ? 'Je hebt gewonnen!' : paused ? 'Gepauzeerd' : running ? 'Spel actief' : 'Klaar om te spelen';
  statusLight.style.width = running ? '100%' : game.phase === 'over' ? '0%' : '35%';
  pauseButton.disabled = game.phase !== 'running';
  pauseButton.firstChild.textContent = paused ? 'HERVAT ' : 'PAUZEER ';
}
function paint() {
  ctx.fillStyle = '#08111b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(113, 149, 172, .095)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i += 1) {
    const p = i * TILE + .5;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
  }
  if (game.food) {
    const x = (game.food.x + .5) * TILE;
    const y = (game.food.y + .5) * TILE;
    ctx.save();
    ctx.shadowColor = '#b58dff'; ctx.shadowBlur = 19;
    ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#b99aff'; ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
  game.snake.forEach((part, index) => {
    const x = part.x * TILE + 2;
    const y = part.y * TILE + 2;
    ctx.save();
    if (index === 0) { ctx.shadowColor = '#70eee5'; ctx.shadowBlur = 18; }
    ctx.fillStyle = index === 0 ? '#8cf4e9' : index % 2 ? '#3db8bd' : '#56cfcd';
    ctx.beginPath(); ctx.roundRect(x, y, TILE - 4, TILE - 4, 5); ctx.fill();
    if (index === 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a3037';
      const vector = { right: [8, 5], left: [4, 5], up: [5, 4], down: [5, 8] }[game.direction];
      const eyeX = game.direction === 'left' || game.direction === 'right' ? vector[0] : 5;
      const eyeY = game.direction === 'up' || game.direction === 'down' ? vector[1] : 5;
      ctx.fillRect(x + eyeX, y + eyeY, 3, 3);
      ctx.fillRect(x + (game.direction === 'left' || game.direction === 'right' ? eyeX : 12), y + (game.direction === 'up' || game.direction === 'down' ? eyeY : 12), 3, 3);
    }
    ctx.restore();
  });
}
function tick(now) {
  if (game.phase === 'running' && !paused && now - lastTick >= Math.max(75, 160 - game.score * 3)) {
    lastTick = now;
    game = advance(game);
    if (game.score > best) setBest(game.score);
    if (game.phase === 'over') showOverlay('SIGNAL LOST', 'Game over.', `Je score: ${game.score}. Nog een poging?`, 'OPNIEUW SPELEN');
    if (game.phase === 'won') showOverlay('PERFECT RUN', 'Je hebt gewonnen!', `Je score: ${game.score}.`, 'NOG EEN KEER');
    sync();
  }
  paint();
  frame = requestAnimationFrame(tick);
}
function start() {
  game = { ...newGame(), phase: 'running' };
  paused = false;
  lastTick = performance.now();
  overlay.hidden = true;
  sync();
}
function togglePause() {
  if (game.phase !== 'running') return;
  paused = !paused;
  if (paused) showOverlay('GAME PAUSED', 'Even pauze.', 'Je spel staat stil. Ga verder wanneer je klaar bent.', 'HERVAT SPEL');
  else { overlay.hidden = true; lastTick = performance.now(); }
  sync();
}
function steer(direction) {
  if (paused || game.phase !== 'running') return;
  game = turn(game, direction);
}
startButton.addEventListener('click', () => {
  if (paused && game.phase === 'running') togglePause();
  else start();
});
pauseButton.addEventListener('click', togglePause);
const keys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
document.addEventListener('keydown', event => {
  const direction = keys[event.key];
  if (direction) { event.preventDefault(); steer(direction); }
  else if (event.code === 'Space') { event.preventDefault(); start(); }
  else if (event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); }
  else if (event.key === 'Enter' && !overlay.hidden) { event.preventDefault(); startButton.click(); }
});
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => steer(button.dataset.direction)));
let touchStart = null;
canvas.addEventListener('touchstart', event => { touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }, { passive: true });
canvas.addEventListener('touchend', event => {
  if (!touchStart) return;
  const x = event.changedTouches[0].clientX - touchStart.x;
  const y = event.changedTouches[0].clientY - touchStart.y;
  if (Math.max(Math.abs(x), Math.abs(y)) > 18) steer(Math.abs(x) > Math.abs(y) ? x > 0 ? 'right' : 'left' : y > 0 ? 'down' : 'up');
  touchStart = null;
}, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.phase === 'running' && !paused) togglePause(); });
bestNode.textContent = pad(best);
paint();
frame = requestAnimationFrame(tick);
