import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { existsSync } from 'node:fs';
import { SiteInputSchema, type Site, type SiteInput } from '@pm2-launcher/shared';
import {
  deleteProcess,
  dump,
  listProcesses,
  reloadProcess,
  restartProcess,
  startProcess,
  stopProcess,
  subscribeLogs,
} from '../pm2-client';
import {
  getApp,
  readEcosystem,
  removeApp,
  upsertApp,
} from '../ecosystem';

export const sitesRoute = new Hono();

async function buildSiteList(): Promise<Site[]> {
  const [pmList, ecosystem] = await Promise.all([
    listProcesses(),
    readEcosystem(),
  ]);
  const ecoByName = new Map(ecosystem.map((a) => [a.name, a]));
  const pmByName = new Map(pmList.map((p) => [p.name, p]));

  const names = new Set<string>([...pmByName.keys(), ...ecoByName.keys()]);
  const sites: Site[] = [];
  for (const name of names) {
    const eco = ecoByName.get(name);
    const pm = pmByName.get(name);
    const base: SiteInput = eco ?? {
      name,
      cwd: '',
      env: {},
      autorestart: true,
      instances: 1,
    };
    const runtime = pm?.runtime ?? {
      pmId: null,
      status: 'stopped' as const,
      pid: null,
      cpu: 0,
      memory: 0,
      uptimeMs: null,
      restarts: 0,
      managedByLauncher: !!eco,
      outLog: null,
      errLog: null,
    };
    if (eco) runtime.managedByLauncher = true;
    sites.push({ ...base, runtime });
  }
  sites.sort((a, b) => a.name.localeCompare(b.name));
  return sites;
}

sitesRoute.get('/', async (c) => {
  const sites = await buildSiteList();
  return c.json({ sites });
});

sitesRoute.get('/:name', async (c) => {
  const name = c.req.param('name');
  const sites = await buildSiteList();
  const site = sites.find((s) => s.name === name);
  if (!site) return c.json({ error: 'not found' }, 404);
  return c.json({ site });
});

sitesRoute.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = SiteInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  await upsertApp(input);
  await startProcess(input);
  await dump();
  return c.json({ ok: true });
});

sitesRoute.patch('/:name', async (c) => {
  const name = c.req.param('name');
  const body = await c.req.json();
  const existing = await getApp(name);
  if (!existing) return c.json({ error: 'not managed by launcher' }, 404);
  const merged = { ...existing, ...body, name };
  const parsed = SiteInputSchema.safeParse(merged);
  if (!parsed.success) {
    return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400);
  }
  await upsertApp(parsed.data);
  try {
    await deleteProcess(name);
  } catch {
    // not running — fine
  }
  await startProcess(parsed.data);
  await dump();
  return c.json({ ok: true });
});

sitesRoute.delete('/:name', async (c) => {
  const name = c.req.param('name');
  try {
    await deleteProcess(name);
  } catch {
    // not running — fine
  }
  await removeApp(name);
  await dump();
  return c.json({ ok: true });
});

sitesRoute.post('/:name/start', async (c) => {
  const name = c.req.param('name');
  const app = await getApp(name);
  if (app) {
    await startProcess(app);
  } else {
    // already in pm2 from outside launcher
    await reloadProcess(name).catch(() => undefined);
  }
  await dump();
  return c.json({ ok: true });
});

sitesRoute.post('/:name/stop', async (c) => {
  await stopProcess(c.req.param('name'));
  await dump();
  return c.json({ ok: true });
});

sitesRoute.post('/:name/restart', async (c) => {
  await restartProcess(c.req.param('name'));
  return c.json({ ok: true });
});

sitesRoute.post('/:name/import', async (c) => {
  const name = c.req.param('name');
  const pm = (await listProcesses()).find((p) => p.name === name);
  if (!pm) return c.json({ error: 'not in pm2' }, 404);

  const env: Record<string, string> = { ...pm.env };
  const portRaw = env.PORT;
  const port = portRaw !== undefined ? Number(portRaw) : undefined;
  delete env.PORT;
  delete env.PM2_LAUNCHER;
  // Strip noisy inherited shell env from snapshot — keep only what looks
  // app-relevant. Heuristic: keep keys the user explicitly set if they look
  // like APP_* / NEXT_PUBLIC_* / *_KEY / *_SECRET / *_URL etc. For V1 we
  // keep all non-PORT/PM2_LAUNCHER env so the import is faithful.

  // We need cwd, script, args, interpreter — pm2.list gives these via pm2_env.
  // listProcesses() doesn't expose them; fetch directly:
  const { default: pm2 } = await import('pm2');
  const fullList = await new Promise<Array<Record<string, unknown>>>(
    (resolve, reject) => {
      pm2.list((err, l) =>
        err ? reject(err) : resolve(l as Array<Record<string, unknown>>),
      );
    },
  );
  const proc = fullList.find((p) => p.name === name);
  if (!proc) return c.json({ error: 'not in pm2' }, 404);
  const pmEnv = proc.pm2_env as Record<string, unknown> | undefined;

  const input: SiteInput = SiteInputSchema.parse({
    name,
    cwd: String(pmEnv?.pm_cwd ?? pmEnv?.cwd ?? ''),
    script: pmEnv?.pm_exec_path ? String(pmEnv.pm_exec_path) : undefined,
    interpreter: pmEnv?.exec_interpreter
      ? String(pmEnv.exec_interpreter)
      : undefined,
    args: Array.isArray(pmEnv?.args) ? (pmEnv.args as string[]).join(' ') : undefined,
    port: port !== undefined && !Number.isNaN(port) ? port : undefined,
    env,
    autorestart: pmEnv?.autorestart !== false,
    instances:
      typeof pmEnv?.instances === 'number' ? (pmEnv.instances as number) : 1,
  });

  await upsertApp(input);
  // Re-launch under launcher control so env.PM2_LAUNCHER=1 takes effect.
  try {
    await deleteProcess(name);
  } catch {}
  await startProcess(input);
  await dump();
  return c.json({ ok: true });
});

sitesRoute.get('/:name/logs', (c) => {
  const name = c.req.param('name');
  return streamSSE(c, async (stream) => {
    let closed = false;
    stream.onAbort(() => {
      closed = true;
    });

    // Send historical tail first.
    const sites = await buildSiteList();
    const site = sites.find((s) => s.name === name);
    if (site?.runtime.outLog && existsSync(site.runtime.outLog)) {
      const tail = await tailFile(site.runtime.outLog, 200);
      if (tail) await stream.writeSSE({ event: 'history', data: JSON.stringify({ stream: 'out', data: tail }) });
    }
    if (site?.runtime.errLog && existsSync(site.runtime.errLog)) {
      const tail = await tailFile(site.runtime.errLog, 200);
      if (tail) await stream.writeSSE({ event: 'history', data: JSON.stringify({ stream: 'err', data: tail }) });
    }

    const unsubscribe = await subscribeLogs(name, (line) => {
      if (closed) return;
      stream.writeSSE({ event: 'log', data: JSON.stringify(line) }).catch(() => {});
    });

    // Heartbeat to keep the connection warm and detect disconnects.
    while (!closed) {
      await stream.sleep(15000);
      if (closed) break;
      await stream.writeSSE({ event: 'ping', data: String(Date.now()) }).catch(() => {
        closed = true;
      });
    }
    unsubscribe();
  });
});

async function tailFile(path: string, lines: number): Promise<string> {
  const text = await Bun.file(path).text();
  const all = text.split('\n');
  const start = Math.max(0, all.length - lines - 1);
  return all.slice(start).join('\n');
}
