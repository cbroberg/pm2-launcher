import pm2 from 'pm2';
import type { SiteInput, SiteRuntime, SiteStatus } from '@pm2-launcher/shared';

let connected = false;

function connect(): Promise<void> {
  if (connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    pm2.connect(false, (err) => {
      if (err) return reject(err);
      connected = true;
      resolve();
    });
  });
}

export async function ensureConnected(): Promise<void> {
  await connect();
}

type PM2Proc = {
  name?: string;
  pm_id?: number;
  pid?: number;
  pm2_env?: {
    status?: string;
    pm_uptime?: number;
    restart_time?: number;
    unstable_restarts?: number;
    pm_out_log_path?: string;
    pm_err_log_path?: string;
    env?: Record<string, string>;
  };
  monit?: { cpu?: number; memory?: number };
};

export async function listProcesses(): Promise<
  Array<{ name: string; runtime: SiteRuntime; env: Record<string, string> }>
> {
  await connect();
  const list = await new Promise<PM2Proc[]>((resolve, reject) => {
    pm2.list((err, l) => (err ? reject(err) : resolve(l as PM2Proc[])));
  });

  const now = Date.now();
  return list
    .filter((p) => p.name)
    .map((p) => {
      const env = p.pm2_env?.env ?? {};
      const status = (p.pm2_env?.status ?? 'unknown') as SiteStatus;
      const startedAt = p.pm2_env?.pm_uptime;
      return {
        name: p.name as string,
        env,
        runtime: {
          pmId: p.pm_id ?? null,
          status,
          pid: p.pid ?? null,
          cpu: p.monit?.cpu ?? 0,
          memory: p.monit?.memory ?? 0,
          uptimeMs: startedAt && status === 'online' ? now - startedAt : null,
          restarts: p.pm2_env?.restart_time ?? 0,
          managedByLauncher: env.PM2_LAUNCHER === '1',
          outLog: p.pm2_env?.pm_out_log_path ?? null,
          errLog: p.pm2_env?.pm_err_log_path ?? null,
        },
      };
    });
}

type StartOptions = {
  name: string;
  cwd: string;
  script?: string;
  interpreter?: string;
  args?: string;
  instances?: number;
  exec_mode?: 'fork' | 'cluster';
  autorestart?: boolean;
  env?: Record<string, string>;
};

const pm2Start = pm2.start as unknown as (
  opts: StartOptions,
  cb: (err: Error | null) => void,
) => void;

export async function startProcess(input: SiteInput): Promise<void> {
  await connect();
  const env: Record<string, string> = { ...input.env, PM2_LAUNCHER: '1' };
  if (input.port !== undefined) env.PORT = String(input.port);
  await new Promise<void>((resolve, reject) => {
    pm2Start(
      {
        name: input.name,
        cwd: input.cwd,
        script: input.script,
        interpreter: input.interpreter,
        args: input.args,
        instances: input.instances,
        exec_mode: input.instances > 1 ? 'cluster' : 'fork',
        autorestart: input.autorestart,
        env,
      },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

export async function stopProcess(name: string): Promise<void> {
  await connect();
  await new Promise<void>((resolve, reject) => {
    pm2.stop(name, (err) => (err ? reject(err) : resolve()));
  });
}

export async function restartProcess(name: string): Promise<void> {
  await connect();
  await new Promise<void>((resolve, reject) => {
    pm2.restart(name, (err) => (err ? reject(err) : resolve()));
  });
}

export async function deleteProcess(name: string): Promise<void> {
  await connect();
  await new Promise<void>((resolve, reject) => {
    pm2.delete(name, (err) => (err ? reject(err) : resolve()));
  });
}

export async function reloadProcess(name: string): Promise<void> {
  await connect();
  await new Promise<void>((resolve, reject) => {
    pm2.reload(name, (err) => (err ? reject(err) : resolve()));
  });
}

export async function dump(): Promise<void> {
  await connect();
  await new Promise<void>((resolve, reject) => {
    pm2.dump((err) => (err ? reject(err) : resolve()));
  });
}

type LogEvent = {
  data: string;
  process: { name: string; pm_id: number };
  at: number;
};

type LogBus = {
  on: (event: string, cb: (data: unknown) => void) => void;
  off?: (event: string, cb: (data: unknown) => void) => void;
  close?: () => void;
};

let busPromise: Promise<LogBus> | null = null;

function getBus(): Promise<LogBus> {
  if (busPromise) return busPromise;
  busPromise = (async () => {
    await connect();
    return new Promise<LogBus>((resolve, reject) => {
      pm2.launchBus((err, bus) => {
        if (err) {
          busPromise = null;
          return reject(err);
        }
        resolve(bus as unknown as LogBus);
      });
    });
  })();
  return busPromise;
}

export async function subscribeLogs(
  name: string,
  onLine: (line: { stream: 'out' | 'err'; data: string; at: number }) => void,
): Promise<() => void> {
  const bus = await getBus();
  const handleOut = (raw: unknown): void => {
    const evt = raw as LogEvent;
    if (evt.process?.name !== name) return;
    onLine({ stream: 'out', data: evt.data, at: evt.at ?? Date.now() });
  };
  const handleErr = (raw: unknown): void => {
    const evt = raw as LogEvent;
    if (evt.process?.name !== name) return;
    onLine({ stream: 'err', data: evt.data, at: evt.at ?? Date.now() });
  };
  bus.on('log:out', handleOut);
  bus.on('log:err', handleErr);
  return () => {
    bus.off?.('log:out', handleOut);
    bus.off?.('log:err', handleErr);
  };
}
