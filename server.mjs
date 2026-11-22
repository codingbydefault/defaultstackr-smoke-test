import http from 'node:http';
import { createLeaderboardApi } from './src/leaderboard-api.mjs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const revision = process.env.GIT_COMMIT_SHA?.slice(0, 7) || (() => {
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'local'; }
})();

const JS = 'text/javascript; charset=utf-8';
const leaderboardApi = createLeaderboardApi();
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/game.js', ['game.js', JS]],
  ['/game-core.mjs', ['game-core.mjs', JS]],
  ['/games/hub.js', ['games/hub.js', JS]],
  ['/games/leaderboard-ui.mjs', ['games/leaderboard-ui.mjs', JS]],
  ['/games/engine.mjs', ['games/engine.mjs', JS]],
  ['/games/snake-game.js', ['games/snake-game.js', JS]],
  ['/games/space-tetris-core.mjs', ['games/space-tetris-core.mjs', JS]],
  ['/games/space-tetris-game.js', ['games/space-tetris-game.js', JS]],
  ['/games/impact-core.mjs', ['games/impact-core.mjs', JS]],
  ['/games/impact-game.js', ['games/impact-game.js', JS]],
  ['/games/bounce-core.mjs', ['games/bounce-core.mjs', JS]],
  ['/games/bounce-game.js', ['games/bounce-game.js', JS]],
  ['/games/pairs-core.mjs', ['games/pairs-core.mjs', JS]],
  ['/games/pairs-game.js', ['games/pairs-game.js', JS]],
  ['/games/racer-core.mjs', ['games/racer-core.mjs', JS]],
  ['/games/racer-game.js', ['games/racer-game.js', JS]],
  ['/games/trap-core.mjs', ['games/trap-core.mjs', JS]],
  ['/games/trap-game.js', ['games/trap-game.js', JS]],
  ['/games/coaster-core.mjs', ['games/coaster-core.mjs', JS]],
  ['/games/coaster-park-game.js', ['games/coaster-park-game.js', JS]],
]);

http.createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (pathname.startsWith('/api/')) return leaderboardApi(request, response);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (pathname === '/healthz' || pathname === '/version') {
    response.writeHead(200, headers);
    response.end(JSON.stringify(pathname === '/healthz'
      ? { status: 'ok', app: 'defaultstackr-smoke-test', revision }
      : { revision }));
    return;
  }
  const asset = assets.get(pathname);
  if (!asset) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' });
    response.end('Niet gevonden');
    return;
  }
  try {
    const body = await readFile(new URL(`./public/${asset[0]}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(asset[0] === 'index.html' ? body.toString().replaceAll('__REVISION__', revision) : body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Pagina laden mislukt');
  }
}).listen(Number(process.env.PORT || 8080), '127.0.0.1');
