import type { SiteInput, SiteRuntime, SiteStatus } from '@pm2-launcher/shared';

async function pm2(args: string[]): Promise<string> {
  const proc = Bun.spawn(['pm2', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  if (proc.exitCode !== 0) {
    const msg = stderr.trim() || stdout.trim() || `pm2 ${args[0]} exited ${proc.exitCode}`;
    throw new Error(msg);
  }
  return stdout;
}

type PM2Proc = {
  name: string;
  pm_id: number;
  pid: number | null;
  pm2_env: {
    status: string;
    pm_uptime?: number;
    restart_time: number;
    unstable_restarts: number;
    pm_out_log_path: string;
    pm_err_log_path: string;
    env: Record<string, string>;
    cwd?: string;
    pm_exec_path?: string;
    exec_interpreter?: string;
    args?: string | string[];
  };
  monit: { cpu: number; memory: number };
};

export async function listProcesses(): Promise<
  Array<{ name: string; runtime: SiteRuntime; env: Record<string, string> }>
> {
  const raw = await pm2(['jlist']);
  // pm2 may print status lines like "[PM2] ..." before the JSON array
  const jsonStart = raw.indexOf('[');
  const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  const list = JSON.parse(jsonStr) as PM2Proc[];
  const now = Date.now();
  return list
    .filter((p) => p.name)
    .map((p) => {
      const env = p.pm2_env?.env ?? {};
      const status = (p.pm2_env?.status ?? 'unknown') as SiteStatus;
      const startedAt = p.pm2_env?.pm_uptime;
      return {
        name: p.name,
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

export async function startProcess(input: SiteInput): Promise<void> {
  const { ECOSYSTEM_PATH } = await import('./config');
  await pm2(['start', ECOSYSTEM_PATH, '--only', input.name]);
}

export async function stopProcess(name: string): Promise<void> {
  await pm2(['stop', name]);
}

export async function restartProcess(name: string): Promise<void> {
  await pm2(['restart', name]);
}

export async function deleteProcess(name: string): Promise<void> {
  await pm2(['delete', name]);
}

export async function reloadProcess(name: string): Promise<void> {
  await pm2(['reload', name]);
}

export async function dump(): Promise<void> {
  await pm2(['save']);
}

export async function subscribeLogs(
  name: string,
  onLine: (line: { stream: 'out' | 'err'; data: string; at: number }) => void,
): Promise<() => void> {
  const procs = await listProcesses();
  const proc = procs.find((p) => p.name === name);
  const outLog = proc?.runtime.outLog;
  const errLog = proc?.runtime.errLog;

  const tails: ReturnType<typeof Bun.spawn>[] = [];
  const cleanups: (() => void)[] = [];

  async function tailFile(
    path: string,
    stream: 'out' | 'err',
  ): Promise<void> {
    if (!path) return;
    const child = Bun.spawn(['tail', '-F', '-n', '0', path], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
    tails.push(child);
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const pump = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            onLine({ stream, data: line, at: Date.now() });
          }
        }
      } catch {
        // closed
      }
    };
    pump().catch(() => {});
  }

  if (outLog) await tailFile(outLog, 'out');
  if (errLog) await tailFile(errLog, 'err');

  return () => {
    for (const child of tails) {
      try { child.kill(); } catch {}
    }
    for (const fn of cleanups) fn();
  };
}

// kept for compatibility — no-op since CLI doesn't need a persistent connection
export async function ensureConnected(): Promise<void> {}
