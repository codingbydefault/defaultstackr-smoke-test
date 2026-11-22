import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';

export const GAMES = Object.freeze([
  'snake', 'space_tetris', 'space_impact', 'bounce',
  'pairs', 'pole_position', 'trap', 'coaster_park'
]);
const SCORE_RATE = Object.freeze({
  snake: 20, space_tetris: 400, space_impact: 500, bounce: 300,
  pairs: 100, pole_position: 1500, trap: 1500, coaster_park: 20000
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (token) => createHash('sha256').update(token).digest('hex');

export function validNickname(s) {
  return typeof s === 'string' && s === s.trim()
    && /^[\p{L}\p{N}_. -]{2,24}$/u.test(s);
}
export function plausibleScore(game, score, seconds) {
  return GAMES.includes(game) && Number.isSafeInteger(score)
    && score >= 0 && score <= 1_000_000_000
    && Number.isFinite(seconds) && seconds >= 2 && seconds <= 14_400
    && score <= 1_000 + SCORE_RATE[game] * seconds;
}
function answer(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw Object.assign(new Error('Expected application/json'), { status: 415 });
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw) > 4096) throw Object.assign(new Error('Payload too large'), { status: 413 });
  }
  try {
    const input = JSON.parse(raw);
    if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    return input;
  } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
export function createLeaderboardApi({ databaseUrl = process.env.ARCADE_DATABASE_URL } = {}) {
  const pool = databaseUrl ? new Pool({
    connectionString: databaseUrl, max: 4,
    connectionTimeoutMillis: 4000, idleTimeoutMillis: 15000
  }) : null;
  const limits = new Map();
  const checkLimit = (req) => {
    const now = Date.now(), key = req.socket.remoteAddress || 'unknown';
    if (limits.size > 1000) for (const [k,v] of limits) if (v.until < now) limits.delete(k);
    const value = limits.get(key);
    if (!value || value.until < now) { limits.set(key, { count: 1, until: now + 60_000 }); return false; }
    value.count++;
    return value.count > 120;
  };
  const playerId = async (req) => {
    const match = /^Bearer ([a-zA-Z0-9_-]{40,128})$/.exec(req.headers.authorization || '');
    if (!match) return null;
    const result = await pool.query(
      'SELECT id FROM public.arcade_players WHERE token_hash = $1',
      [hash(match[1])]
    );
    return result.rows[0]?.id || null;
  };
  return async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!pool) return answer(res, 503, { error: 'Leaderboard disabled until database is configured' });
    if (checkLimit(req)) return answer(res, 429, { error: 'Rate limit exceeded' });
    try {
      if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
        const game = url.searchParams.get('game') || 'snake';
        if (!GAMES.includes(game)) return answer(res, 400, { error: 'Unknown game' });
        const supplied = Number(url.searchParams.get('limit') || 10);
        const limit = Number.isInteger(supplied) ? Math.min(Math.max(supplied,1),100) : 10;
        const scores = await pool.query(
          'SELECT nickname,best_score FROM public.arcade_leaderboard WHERE game_code=$1 ORDER BY best_score DESC,nickname ASC LIMIT $2',
          [game,limit]
        );
        return answer(res, 200, { game, leaderboard: scores.rows });
      }
      if (req.method === 'POST' && url.pathname === '/api/players') {
        const data = await body(req);
        if (!validNickname(data.nickname)) return answer(res, 400, { error: 'Invalid nickname (2-24 characters)' });
        const token = randomBytes(32).toString('base64url');
        const result = await pool.query(
          'INSERT INTO public.arcade_players (nickname,token_hash) VALUES ($1,$2) RETURNING id',
          [data.nickname,hash(token)]
        );
        return answer(res, 201, { player_id: result.rows[0].id, nickname: data.nickname, token });
      }
      if (req.method === 'POST' && url.pathname === '/api/sessions') {
        const id = await playerId(req);
        if (!id) return answer(res, 401, { error: 'Unauthorized player' });
        const data = await body(req);
        if (!GAMES.includes(data.game_code)) return answer(res, 400, { error: 'Unknown game' });
        const recent = await pool.query(
          "SELECT count(*)::int AS total FROM public.arcade_sessions WHERE player_id=$1 AND started_at > now() - interval '30 seconds'",
          [id]
        );
        if (recent.rows[0].total >= 6) return answer(res, 429, { error: 'Too many game sessions' });
        const created = await pool.query(
          'INSERT INTO public.arcade_sessions(player_id,game_code) VALUES ($1,$2) RETURNING id',
          [id,data.game_code]
        );
        return answer(res, 201, { session_id: created.rows[0].id });
      }
      if (req.method === 'POST' && url.pathname === '/api/scores') {
        const id = await playerId(req);
        if (!id) return answer(res, 401, { error: 'Unauthorized player' });
        const data = await body(req);
        if (!UUID.test(data.session_id || '') || !Number.isSafeInteger(data.score)
            || data.score < 0 || data.score > 1_000_000_000) {
          return answer(res, 400, { error: 'Invalid session or score' });
        }
        const tx = await pool.connect();
        try {
          await tx.query('BEGIN');
          const found = await tx.query(
            'SELECT game_code,started_at,finished_at FROM public.arcade_sessions WHERE id=$1 AND player_id=$2 FOR UPDATE',
            [data.session_id,id]
          );
          if (!found.rows[0] || found.rows[0].finished_at) {
            await tx.query('ROLLBACK');
            return answer(res, 409, { error: 'Game session not active' });
          }
          const session = found.rows[0];
          const seconds = (Date.now() - new Date(session.started_at).getTime()) / 1000;
          const verified = plausibleScore(session.game_code,data.score,seconds);
          await tx.query('UPDATE public.arcade_sessions SET finished_at=now() WHERE id=$1', [data.session_id]);
          await tx.query(
            'INSERT INTO public.arcade_scores(session_id,score,verified) VALUES ($1,$2,$3)',
            [data.session_id,data.score,verified]
          );
          await tx.query('COMMIT');
          return answer(res, 201, { saved: true, verified });
        } catch (error) {
          await tx.query('ROLLBACK').catch(() => {});
          throw error;
        } finally { tx.release(); }
      }
      return answer(res, 404, { error: 'Not found' });
    } catch (error) {
      if (error.status) return answer(res, error.status, { error: error.message });
      console.error('Arcade leaderboard error',error?.code || error?.name || 'unknown');
      return answer(res, 500, { error: 'Internal server error' });
    }
  };
}
