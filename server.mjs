import http from 'node:http';

const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DefaultStackr · Testpagina</title><style>body{min-height:100vh;margin:0;display:grid;place-items:center;background:radial-gradient(circle at 70% 20%,#582477 0,transparent 38%),#08050c;color:#f7ecff;font:16px system-ui}main{max-width:620px;padding:48px;border:1px solid #a965d0;border-radius:22px;background:#1b0e25;box-shadow:0 0 75px #933dc755}small{color:#d59aff;letter-spacing:.2em}h1{font-size:clamp(36px,7vw,68px);margin:20px 0;line-height:1.02}p{color:#c5afd2;line-height:1.6}a{color:#e4b4ff}</style></head><body><main><small>DEFAULTSTACKR / TESTDEPLOY</small><h1>Je eerste pagina staat online.</h1><p>Deze testpagina draait vanaf GitHub op je eigen DefaultStackr-server. Als je dit ziet, werken de deploy-worker, Nginx en de Cloudflare-route samen.</p><a href="/healthz">Controleer de gezondheidscheck ↗</a></main></body></html>`;

http.createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 'ok', app: 'defaultstackr-smoke-test' }));
    return;
  }
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    response.end(html);
    return;
  }
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Niet gevonden');
}).listen(Number(process.env.PORT || 8080), '127.0.0.1');
