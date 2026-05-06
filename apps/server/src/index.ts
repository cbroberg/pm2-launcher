import { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitesRoute } from './routes/sites';
import { ensureConnected } from './pm2-client';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const WEB_DIST = join(REPO_ROOT, 'apps', 'web', 'dist');

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/sites', sitesRoute);

app.onError((err, c) => {
  console.error('[pm2-launcher] unhandled error:', err);
  return c.json({ error: err.message ?? 'Internal server error' }, 500);
});

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function mime(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? (MIME[path.slice(dot)] ?? 'application/octet-stream') : 'application/octet-stream';
}

async function serveFile(absPath: string): Promise<Response | null> {
  if (!existsSync(absPath)) return null;
  const file = Bun.file(absPath);
  return new Response(file, { headers: { 'Content-Type': mime(absPath) } });
}

async function handleStatic(reqPath: string): Promise<Response | null> {
  const safe = normalize(decodeURIComponent(reqPath)).replace(/^\/+/, '');
  if (safe.startsWith('..')) return null;
  if (safe) {
    const candidate = join(WEB_DIST, safe);
    if (candidate.startsWith(WEB_DIST)) {
      const direct = await serveFile(candidate);
      if (direct) return direct;
    }
  }
  // SPA fallback — always fresh so browser fetches the latest JS hash
  const html = await serveFile(join(WEB_DIST, 'index.html'));
  if (!html) return null;
  html.headers.set('Cache-Control', 'no-store');
  return html;
}

if (existsSync(WEB_DIST)) {
  app.get('/', async (c) => {
    const res = await handleStatic('/');
    return res ?? c.notFound();
  });
  app.get('/assets/*', async (c) => {
    const res = await handleStatic(c.req.path);
    return res ?? c.notFound();
  });
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api/')) return c.text('Not found', 404);
    const res = await handleStatic(c.req.path);
    return res ?? c.text('Not found', 404);
  });
} else {
  app.get('/', (c) =>
    c.text(
      `pm2-launcher API is running.\nWeb bundle not found at ${WEB_DIST}.\nRun: pnpm build`,
      200,
    ),
  );
}

const port = Number(process.env.PORT ?? 4173);
const hostname = process.env.HOST ?? '127.0.0.1';

ensureConnected().catch((err) => {
  console.error('[pm2-launcher] PM2 connect failed:', err);
});

console.log(`[pm2-launcher] listening on http://${hostname}:${port}`);

export default {
  port,
  hostname,
  fetch: app.fetch,
  idleTimeout: 0,
};
