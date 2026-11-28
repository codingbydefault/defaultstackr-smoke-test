const TOKEN_KEY = 'defaultstackr-arcade-player-token';
const NAME_KEY = 'defaultstackr-arcade-player-nickname';
const SKIP_KEY = 'defaultstackr-arcade-player-skip';
const GAME_LABELS = {
  snake: 'Snake', space_tetris: 'Space Tetris', space_impact: 'Space Impact',
  bounce: 'Bounce', pairs: 'Pairs', pole_position: 'Pole Position',
  trap: 'Trap!', coaster_park: 'Coaster Park'
};
const stored = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } };
const forget = (key) => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };

async function api(path, { token, payload } = {}) {
  const response = await fetch(path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Verbinding mislukt');
  return result;
}

export function createLeaderboardUI(hub) {
  const panel = document.createElement('section');
  panel.className = 'arcade-board';
  panel.innerHTML = `
    <h2>WERELDWIJDE HIGHSCORES</h2>
    <div class="arcade-profile">
      <label for="arcade-nickname">Spelersnaam</label>
      <input id="arcade-nickname" maxlength="24" placeholder="Jouw nickname" autocomplete="nickname">
      <button type="button" id="arcade-new-player">Wijzig naam</button>
      <label for="arcade-game">Ranglijst</label>
      <select id="arcade-game"></select>
      <button type="button" id="arcade-refresh">Vernieuwen</button>
    </div>
    <p id="arcade-message" class="arcade-note" role="status"></p>
    <ol id="arcade-leaderboard"></ol>
    <p class="arcade-note">Highscores worden na afloop van een spel ingezonden. Basiscontroles beperken misbruik; volledige anti-cheat vereist server-side spelvalidatie.</p>
  `;
  const selector = panel.querySelector('#arcade-game');
  for (const [value, label] of Object.entries(GAME_LABELS)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    selector.appendChild(option);
  }
  const input = panel.querySelector('#arcade-nickname');
  const message = panel.querySelector('#arcade-message');
  const list = panel.querySelector('#arcade-leaderboard');
  let token = stored(TOKEN_KEY);
  input.value = stored(NAME_KEY) || '';
  input.disabled = Boolean(token);
  hub?.appendChild(panel);

  /* ------------------------------------------------------------------ */
  /* Username pop-up                                                      */
  /* ------------------------------------------------------------------ */
  const modal = document.createElement('div');
  modal.className = 'arcade-modal-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="arcade-modal" role="dialog" aria-modal="true" aria-labelledby="arcade-modal-title">
      <p class="arcade-modal-kicker">DEFAULTSTACKR · DEEP SPACE ARCADE</p>
      <h2 id="arcade-modal-title">Kies je spelersnaam</h2>
      <p class="arcade-modal-copy">Je naam verschijnt op de wereldwijde ranglijst en wordt onthouden voor alle acht games.</p>
      <form id="arcade-modal-form" novalidate>
        <label for="arcade-modal-input">Spelersnaam</label>
        <input id="arcade-modal-input" maxlength="24" minlength="2" placeholder="Jouw nickname" autocomplete="nickname" required>
        <p id="arcade-modal-error" class="arcade-modal-error" role="alert"></p>
        <div class="arcade-modal-actions">
          <button type="submit" id="arcade-modal-submit">START DE MISSIE</button>
          <button type="button" id="arcade-modal-skip">Speel zonder ranglijst</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const modalInput = modal.querySelector('#arcade-modal-input');
  const modalError = modal.querySelector('#arcade-modal-error');
  const modalForm = modal.querySelector('#arcade-modal-form');
  let modalResolve = null;

  function openModal(prefill = '') {
    modalInput.value = prefill;
    modalError.textContent = '';
    modal.hidden = false;
    requestAnimationFrame(() => modalInput.focus());
    return new Promise((resolve) => {
      modalResolve = resolve;
    });
  }

  function closeModal(result) {
    modal.hidden = true;
    modalError.textContent = '';
    if (modalResolve) {
      const resolve = modalResolve;
      modalResolve = null;
      resolve(result);
    }
  }

  function validNickname(value) {
    return /^[\p{L}\p{N}_. -]{2,24}$/u.test(value);
  }

  async function submitNickname(value) {
    const nickname = value.trim();
    if (!validNickname(nickname)) {
      modalError.textContent = 'Gebruik 2–24 letters, cijfers, spaties, punt, streep of underscore.';
      return;
    }
    modalError.textContent = 'Profiel aanmaken…';
    try {
      const data = await api('/api/players', { payload: { nickname } });
      token = data.token;
      save(TOKEN_KEY, token);
      save(NAME_KEY, nickname);
      forget(SKIP_KEY);
      input.value = nickname;
      input.disabled = true;
      message.textContent = `Welkom, ${nickname}! Je highscores worden automatisch ingestuurd.`;
      closeModal(token);
      refresh();
    } catch (error) {
      modalError.textContent = `Kon profiel niet aanmaken: ${error.message}`;
    }
  }

  modalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitNickname(modalInput.value);
  });
  modal.querySelector('#arcade-modal-skip').addEventListener('click', () => {
    const nickname = modalInput.value.trim();
    if (nickname) {
      save(NAME_KEY, nickname);
      input.value = nickname;
    }
    save(SKIP_KEY, '1');
    message.textContent = nickname
      ? `Welkom, ${nickname}. De wereldranglijst is nu niet beschikbaar; je scores blijven lokaal bewaard.`
      : 'Je speelt zonder wereldranglijst. Je scores blijven lokaal bewaard.';
    closeModal(null);
  });

  /* ------------------------------------------------------------------ */
  /* Leaderboard                                                          */
  /* ------------------------------------------------------------------ */
  async function refresh() {
    message.textContent = 'Ranglijst laden…';
    list.replaceChildren();
    try {
      const data = await api(`/api/leaderboard?game=${encodeURIComponent(selector.value)}&limit=100`);
      message.textContent = data.leaderboard.length
        ? `Top ${data.leaderboard.length} — ${GAME_LABELS[selector.value]}`
        : 'Nog geen highscores. Speel als eerste!';
      const nickname = stored(NAME_KEY);
      for (const item of data.leaderboard) {
        const row = document.createElement('li');
        row.textContent = `${item.nickname} — ${item.best_score}`;
        if (nickname && item.nickname === nickname) {
          row.classList.add('arcade-self');
          row.setAttribute('aria-current', 'true');
        }
        list.appendChild(row);
      }
    } catch {
      message.textContent = 'De wereldranglijst is nog niet beschikbaar. De games blijven speelbaar.';
    }
  }

  panel.querySelector('#arcade-refresh').addEventListener('click', refresh);
  selector.addEventListener('change', refresh);
  panel.querySelector('#arcade-new-player').addEventListener('click', async () => {
    token = null;
    forget(TOKEN_KEY);
    input.disabled = false;
    input.value = '';
    message.textContent = 'Kies een nieuwe spelersnaam. Bestaande records blijven bewaard.';
    const nextToken = await openModal(stored(NAME_KEY) || '');
    if (nextToken) {
      input.value = stored(NAME_KEY) || '';
      input.disabled = true;
    }
  });

  async function ensurePlayer() {
    if (token) return token;
    if (stored(SKIP_KEY)) return null;
    const nickname = stored(NAME_KEY) || input.value.trim();
    if (!nickname) return null;
    try {
      const data = await api('/api/players', { payload: { nickname } });
      token = data.token;
      save(TOKEN_KEY, token);
      save(NAME_KEY, nickname);
      input.value = nickname;
      input.disabled = true;
      return token;
    } catch {
      return null;
    }
  }

  function startRun(gameCode) {
    return (async () => {
      try {
        const key = await ensurePlayer();
        if (!key) return null;
        const data = await api('/api/sessions', { token: key, payload: { game_code: gameCode } });
        return data.session_id;
      } catch (error) {
        message.textContent = `Online score niet gestart: ${error.message}`;
        return null;
      }
    })();
  }

  async function finishRun(pendingSession, score) {
    try {
      const sessionId = await pendingSession;
      if (!sessionId) return;
      const result = await api('/api/scores', {
        token,
        payload: { session_id: sessionId, score }
      });
      message.textContent = result.verified
        ? 'Highscore opgeslagen!'
        : 'Score opgeslagen, maar niet geverifieerd.';
      await refresh();
    } catch (error) {
      message.textContent = `Score niet opgeslagen: ${error.message}`;
    }
  }

  /* First visit: ask for a nickname before the player can start a game. */
  if (!token && !stored(SKIP_KEY)) {
    openModal(stored(NAME_KEY) || '');
  } else {
    refresh();
  }

  return { startRun, finishRun };
}
