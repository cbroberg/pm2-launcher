import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const STATE_DIR = join(homedir(), '.pm2-launcher');
export const ECOSYSTEM_PATH = join(STATE_DIR, 'ecosystem.config.cjs');
export const CONFIG_PATH = join(STATE_DIR, 'config.json');

export function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

export type LauncherConfig = {
  port: number;
  host: string;
};

const DEFAULT_HOST = '127.0.0.1';

export async function readConfig(): Promise<LauncherConfig | null> {
  if (!existsSync(CONFIG_PATH)) return null;
  const text = await Bun.file(CONFIG_PATH).text();
  const parsed = JSON.parse(text) as Partial<LauncherConfig>;
  if (typeof parsed.port !== 'number') return null;
  return { port: parsed.port, host: parsed.host ?? DEFAULT_HOST };
}

export async function writeConfig(cfg: LauncherConfig): Promise<void> {
  ensureStateDir();
  await Bun.write(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
}
