// Shared helpers for the three LCD-era games.

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createCanvas(canvas, width, height) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function createLoop(update, draw) {
  let id = 0;
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    update(dt);
    draw();
    id = requestAnimationFrame(frame);
  }
  return {
    start() {
      if (!id) { last = 0; id = requestAnimationFrame(frame); }
    },
    stop() {
      if (id) cancelAnimationFrame(id);
      id = 0;
    }
  };
}

export function onSwipe(element, handler) {
  let start = null;
  const down = (event) => {
    const touch = event.touches[0];
    if (touch) start = { x: touch.clientX, y: touch.clientY };
  };
  const up = (event) => {
    if (!start || !event.changedTouches[0]) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    handler(Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up'));
  };
  element.addEventListener('touchstart', down, { passive: true });
  element.addEventListener('touchend', up, { passive: true });
  return () => {
    element.removeEventListener('touchstart', down);
    element.removeEventListener('touchend', up);
  };
}

export function bindButtons(container, map) {
  const cleanups = [];
  for (const [selector, handler] of Object.entries(map)) {
    container.querySelectorAll(selector).forEach((button) => {
      const press = (event) => { event.preventDefault(); handler(); };
      button.addEventListener('pointerdown', press);
      cleanups.push(() => button.removeEventListener('pointerdown', press));
    });
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

export function showOverlay(overlay, { kicker, title, copy, action, onAction }) {
  overlay.replaceChildren();
  const label = document.createElement('span');
  label.className = 'ov-kicker';
  label.textContent = kicker;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = copy;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ov-action';
  button.textContent = action;
  button.addEventListener('click', onAction);
  overlay.append(label, heading, text, button);
  overlay.hidden = false;
}

export function hideOverlay(overlay) {
  overlay.hidden = true;
}

export function getBest(key) {
  try { return Math.max(0, Number(localStorage.getItem(key)) || 0); }
  catch { return 0; }
}

export function setBest(key, value, current) {
  if (value <= current) return current;
  try { localStorage.setItem(key, String(value)); }
  catch { /* Memory-only score is fine. */ }
  return value;
}

let audioContext = null;
export function beep(enabled, frequency = 440, duration = 0.06) {
  if (!enabled) return;
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.025, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is decorative. */ }
}
