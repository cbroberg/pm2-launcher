import { useEffect, useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Site, SiteInput } from '@pm2-launcher/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SiteCard } from '@/components/site-card';
import { SiteFormModal } from '@/components/site-form-modal';
import { LogsModal } from '@/components/logs-modal';
import { ConfirmModal } from '@/components/confirm-modal';
import { ToastHost, toast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { Moon, Plus, RefreshCw, Sun } from 'lucide-react';

type Filter = 'all' | 'managed';

export function App(): JSX.Element {
  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState<Filter>('managed');
  const [busyName, setBusyName] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [editing, setEditing] = useState<SiteInput | null>(null);
  const [creating, setCreating] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    document.documentElement.classList.contains('light') ? 'light' : 'dark',
  );

  async function refresh(): Promise<void> {
    try {
      const { sites } = await api.list();
      setSites(sites);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  function toggleTheme(): void {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    localStorage.setItem('pm2-launcher-theme', next);
  }

  const visible = useMemo(() => {
    if (filter === 'managed') return sites.filter((s) => s.runtime.managedByLauncher);
    return sites;
  }, [sites, filter]);

  const stats = useMemo(() => {
    const total = sites.length;
    const online = sites.filter((s) => s.runtime.status === 'online').length;
    const managed = sites.filter((s) => s.runtime.managedByLauncher).length;
    return { total, online, managed };
  }, [sites]);

  async function withBusy(name: string, fn: () => Promise<unknown>): Promise<void> {
    setBusyName(name);
    try {
      await fn();
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusyName(null);
    }
  }

  function siteInputFromSite(site: Site): SiteInput {
    return {
      name: site.name,
      cwd: site.cwd,
      script: site.script,
      interpreter: site.interpreter,
      args: site.args,
      port: site.port,
      env: site.env,
      autorestart: site.autorestart,
      instances: site.instances,
    };
  }

  async function handleAction(
    site: Site,
    action: 'start' | 'stop' | 'restart' | 'delete' | 'edit' | 'logs' | 'import',
  ): Promise<void> {
    switch (action) {
      case 'start':
        return withBusy(site.name, async () => {
          await api.start(site.name);
          toast(`${site.name} started`, 'success');
        });
      case 'stop':
        return withBusy(site.name, async () => {
          await api.stop(site.name);
          toast(`${site.name} stopped`, 'success');
        });
      case 'restart':
        return withBusy(site.name, async () => {
          await api.restart(site.name);
          toast(`${site.name} restarted`, 'success');
        });
      case 'delete':
        setConfirmDelete(site.name);
        return;
      case 'edit':
        setEditing(siteInputFromSite(site));
        return;
      case 'logs':
        setLogsFor(site.name);
        return;
      case 'import':
        return withBusy(site.name, async () => {
          await api.importExisting(site.name);
          toast(`${site.name} imported into launcher`, 'success');
        });
    }
  }

  async function handleSave(input: SiteInput): Promise<void> {
    setGlobalBusy(true);
    try {
      if (editing) {
        await api.update(editing.name, input);
        toast(`${input.name} updated`, 'success');
      } else {
        await api.create(input);
        toast(`${input.name} created`, 'success');
      }
      await refresh();
      setCreating(false);
      setEditing(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
      throw err;
    } finally {
      setGlobalBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirmDelete) return;
    const name = confirmDelete;
    setConfirmDelete(null);
    await withBusy(name, async () => {
      await api.remove(name);
      toast(`${name} deleted`, 'success');
    });
  }

  return (
    <div class="min-h-screen">
      <header class="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <h1 class="text-lg font-semibold">
            PM2 Launcher
            <span class="ml-2 text-xs font-normal text-muted-foreground">
              :{window.location.port || '80'}
            </span>
          </h1>
          <div class="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{stats.total} total</Badge>
            <Badge variant="online">{stats.online} online</Badge>
            <Badge variant="secondary">{stats.managed} managed</Badge>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <Button
              variant={filter === 'managed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('managed')}
            >
              Managed only
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh">
              <RefreshCw />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New
            </Button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-4 py-6">
        {visible.length === 0 ? (
          <div class="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            {filter === 'managed'
              ? 'No launcher-managed sites yet. Click "New" to create one, or "All" to import existing PM2 processes.'
              : 'No PM2 processes running.'}
          </div>
        ) : (
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((site) => (
              <SiteCard
                key={site.name}
                site={site}
                busy={busyName === site.name || globalBusy}
                onAction={(action) => handleAction(site, action)}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFormModal
        open={creating || !!editing}
        initial={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={handleSave}
      />

      <LogsModal name={logsFor} onClose={() => setLogsFor(null)} />

      <ConfirmModal
        open={!!confirmDelete}
        title={`Delete ${confirmDelete ?? ''}?`}
        body="The process will be stopped and removed from the ecosystem config. The on-disk app files are not touched."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />

      <ToastHost />
    </div>
  );
}
