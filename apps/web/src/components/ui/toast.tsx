import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { cn } from '@/lib/utils';

type Toast = {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
};

const listeners = new Set<(t: Toast) => void>();
let nextId = 1;

export function toast(message: string, variant: Toast['variant'] = 'info'): void {
  const t = { id: nextId++, message, variant };
  for (const fn of listeners) fn(t);
}

export function ToastHost(): JSX.Element {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const fn = (t: Toast): void => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => {
        setItems((cur) => cur.filter((i) => i.id !== t.id));
      }, 4000);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return (
    <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          class={cn(
            'pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-lg transition-all',
            t.variant === 'success' && 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
            t.variant === 'error' && 'bg-rose-500/15 text-rose-200 border-rose-500/30',
            t.variant === 'info' && 'bg-card text-card-foreground border-border',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
