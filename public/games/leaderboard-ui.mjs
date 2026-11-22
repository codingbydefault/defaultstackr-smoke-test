const TOKEN_KEY = 'defaultstackr-arcade-player-token';
const NAME_KEY = 'defaultstackr-arcade-player-nickname';
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
      <button type="button" id="arcade-new-player">Nieuw profiel</button>
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

  async function refresh() {
    message.textContent = 'Ranglijst laden…';
    list.replaceChildren();
    try {
      const data = await api(`/api/leaderboard?game=${encodeURIComponent(selector.value)}&limit=100`);
      message.textContent = data.leaderboard.length
        ? `Top ${data.leaderboard.length} — ${GAME_LABELS[selector.value]}`
        : 'Nog geen highscores. Speel als eerste!';
      for (const item of data.leaderboard) {
        const row = document.createElement('li');
        row.textContent = `${item.nickname} — ${item.best_score}`;
        list.appendChild(row);
      }
    } catch {
      message.textContent = 'De wereldranglijst is nog niet beschikbaar. De games blijven speelbaar.';
    }
  }

  panel.querySelector('#arcade-refresh').addEventListener('click', refresh);
  selector.addEventListener('change', refresh);
  panel.querySelector('#arcade-new-player').addEventListener('click', () => {
    token = null;
    forget(TOKEN_KEY);
    forget(NAME_KEY);
    input.disabled = false;
    input.value = '';
    input.focus();
    message.textContent = 'Kies een nieuwe spelersnaam. Bestaande records blijven bewaard.';
  });

  async function ensurePlayer() {
    if (token) return token;
    const nickname = input.value.trim();
    if (!nickname) {
      message.textContent = 'Vul voor het spelen een nickname in om op de wereldranglijst te komen.';
      return null;
    }
    const data = await api('/api/players', { payload: { nickname } });
    token = data.token;
    save(TOKEN_KEY, token);
    save(NAME_KEY, nickname);
    input.disabled = true;
    return token;
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
  refresh();
  return { startRun, finishRun };
}
