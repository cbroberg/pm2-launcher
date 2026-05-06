import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  name: string | null;
  onClose: () => void;
};

type LogLine = { stream: 'out' | 'err'; data: string; at?: number };

export function LogsModal({ name, onClose }: Props): JSX.Element {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [follow, setFollow] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!name) return;
    setLines([]);
    setConnected(false);
    const url = `/api/sites/${encodeURIComponent(name)}/logs`;
    const es = new EventSource(url);

    es.addEventListener('history', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { stream: 'out' | 'err'; data: string };
        setLines((prev) => [...prev, { stream: payload.stream, data: payload.data }]);
      } catch {}
    });

    es.addEventListener('log', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as LogLine;
        setLines((prev) => {
          const next = [...prev, payload];
          if (next.length > 2000) next.splice(0, next.length - 2000);
          return next;
        });
      } catch {}
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
    };
  }, [name]);

  useEffect(() => {
    if (!follow) return;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, follow]);

  return (
    <Modal
      open={!!name}
      onClose={onClose}
      title={name ? `Logs — ${name}` : 'Logs'}
      class="max-w-4xl"
      footer={
        <>
          <span class="mr-auto text-xs text-muted-foreground">
            {connected ? 'streaming' : 'disconnected'}
          </span>
          <Button
            variant={follow ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFollow((f) => !f)}
          >
            {follow ? 'Following' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLines([])}>
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div
        ref={containerRef}
        class="h-[60vh] overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-snug"
        onScroll={(e: JSX.TargetedEvent<HTMLDivElement>) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          setFollow(atBottom);
        }}
      >
        {lines.length === 0 ? (
          <div class="text-muted-foreground">Waiting for output…</div>
        ) : (
          lines.map((l, i) => (
            <pre
              key={i}
              class={cn(
                'whitespace-pre-wrap break-words',
                l.stream === 'err' && 'text-rose-300',
              )}
            >
              {l.data}
            </pre>
          ))
        )}
      </div>
    </Modal>
  );
}
