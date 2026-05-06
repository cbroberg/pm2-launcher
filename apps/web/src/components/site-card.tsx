import type { Site } from '@pm2-launcher/shared';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBytes, formatUptime } from '@/lib/utils';
import { ExternalLink, Pencil, Play, RefreshCw, Square, Trash2, ScrollText, DownloadCloud } from 'lucide-react';

type Action = 'start' | 'stop' | 'restart' | 'delete' | 'edit' | 'logs' | 'import';

type Props = {
  site: Site;
  busy: boolean;
  onAction: (action: Action) => void;
};

function statusVariant(status: string): 'online' | 'stopped' | 'errored' | 'launching' {
  if (status === 'online') return 'online';
  if (status === 'errored') return 'errored';
  if (status === 'launching' || status === 'stopping') return 'launching';
  return 'stopped';
}

export function SiteCard({ site, busy, onAction }: Props): preact.JSX.Element {
  const r = site.runtime;
  const online = r.status === 'online';
  const portUrl = site.port && online ? `http://127.0.0.1:${site.port}` : null;
  const managed = r.managedByLauncher;

  return (
    <Card>
      <CardHeader>
        <div class="flex items-start justify-between gap-2">
          <CardTitle class="truncate text-base">{site.name}</CardTitle>
          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          {portUrl ? (
            <a
              href={portUrl}
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              :{site.port} <ExternalLink class="size-3" />
            </a>
          ) : site.port ? (
            <span>:{site.port}</span>
          ) : null}
          {!managed ? <Badge variant="outline">external</Badge> : null}
        </div>
      </CardHeader>
      <CardContent class="space-y-1 text-xs text-muted-foreground">
        <div class="flex justify-between">
          <span>cpu</span>
          <span class="tabular-nums text-foreground">{r.cpu.toFixed(0)}%</span>
        </div>
        <div class="flex justify-between">
          <span>memory</span>
          <span class="tabular-nums text-foreground">{formatBytes(r.memory)}</span>
        </div>
        <div class="flex justify-between">
          <span>uptime</span>
          <span class="tabular-nums text-foreground">{formatUptime(r.uptimeMs)}</span>
        </div>
        <div class="flex justify-between">
          <span>restarts</span>
          <span class="tabular-nums text-foreground">{r.restarts}</span>
        </div>
        {site.cwd ? (
          <div class="flex justify-between gap-2">
            <span class="shrink-0">cwd</span>
            <span class="truncate text-foreground" title={site.cwd}>{site.cwd}</span>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        {online ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('restart')}>
              <RefreshCw /> Restart
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('stop')}>
              <Square /> Stop
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => onAction('start')}>
            <Play /> Start
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('logs')}>
          <ScrollText /> Logs
        </Button>
        {managed ? (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('edit')}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('delete')}>
              <Trash2 /> Delete
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('import')}>
            <DownloadCloud /> Import
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
