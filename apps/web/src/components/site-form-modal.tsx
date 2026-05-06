import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SiteInput } from '@pm2-launcher/shared';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

type Props = {
  open: boolean;
  initial: SiteInput | null;
  onClose: () => void;
  onSubmit: (input: SiteInput) => Promise<void>;
};

const empty: SiteInput = {
  name: '',
  cwd: '',
  script: '',
  interpreter: '',
  args: '',
  port: undefined,
  env: {},
  autorestart: true,
  instances: 1,
};

function envToText(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function textToEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function SiteFormModal({ open, initial, onClose, onSubmit }: Props): JSX.Element {
  const [form, setForm] = useState<SiteInput>(initial ?? empty);
  const [envText, setEnvText] = useState<string>(envToText(initial?.env ?? {}));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? empty);
      setEnvText(envToText((initial ?? empty).env));
      setError(null);
    }
  }, [open, initial]);

  const editing = !!initial;

  function set<K extends keyof SiteInput>(key: K, value: SiteInput[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        script: form.script || undefined,
        interpreter: form.interpreter || undefined,
        args: form.args || undefined,
        port: form.port || undefined,
        env: textToEnv(envText),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${initial?.name}` : 'New site'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : editing ? 'Save' : 'Create & start'}
          </Button>
        </>
      }
    >
      <form class="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <Field label="Name" required full={editing}>
          <Input
            value={form.name}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => set('name', e.currentTarget.value)}
            placeholder="my-app"
            disabled={editing}
            required
          />
        </Field>
        <Field label="Port">
          <Input
            type="number"
            value={form.port ?? ''}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
              const v = e.currentTarget.value;
              set('port', v ? Number(v) : undefined);
            }}
            placeholder="3000"
          />
        </Field>
        <Field label="cwd (absolute path)" required full>
          <Input
            value={form.cwd}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => set('cwd', e.currentTarget.value)}
            placeholder="/Users/cb/Apps/…"
            required
          />
        </Field>
        <Field label="Script">
          <Input
            value={form.script ?? ''}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => set('script', e.currentTarget.value)}
            placeholder="src/index.ts or bun"
          />
        </Field>
        <Field label="Interpreter">
          <Input
            value={form.interpreter ?? ''}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => set('interpreter', e.currentTarget.value)}
            placeholder="bun, node, none, …"
          />
        </Field>
        <Field label="Args" full>
          <Input
            value={form.args ?? ''}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => set('args', e.currentTarget.value)}
            placeholder="run dev, start -p 3000, …"
          />
        </Field>
        <Field label="Instances">
          <Input
            type="number"
            value={form.instances}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) =>
              set('instances', Math.max(1, Number(e.currentTarget.value) || 1))
            }
            min={1}
          />
        </Field>
        <Field label="Autorestart">
          <Button
            type="button"
            variant={form.autorestart ? 'default' : 'outline'}
            size="sm"
            onClick={() => set('autorestart', !form.autorestart)}
          >
            {form.autorestart ? 'Enabled' : 'Disabled'}
          </Button>
        </Field>
        <Field label="Env (KEY=value, one per line)" full>
          <textarea
            value={envText}
            onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) =>
              setEnvText(e.currentTarget.value)
            }
            rows={4}
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            placeholder={'NODE_ENV=production\nFOO=bar'}
          />
        </Field>
        {error ? (
          <div class="md:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function Field({
  label,
  children,
  full,
  required,
}: {
  label: string;
  children: JSX.Element;
  full?: boolean;
  required?: boolean;
}): JSX.Element {
  return (
    <div class={full ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
      <Label>
        {label}
        {required ? <span class="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
