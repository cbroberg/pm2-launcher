import type { Site, SiteInput } from '@pm2-launcher/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export const api = {
  list: () => request<{ sites: Site[] }>('/api/sites'),
  get: (name: string) => request<{ site: Site }>(`/api/sites/${encodeURIComponent(name)}`),
  create: (site: SiteInput) =>
    request<{ ok: true }>('/api/sites', {
      method: 'POST',
      body: JSON.stringify(site),
    }),
  update: (name: string, site: Partial<SiteInput>) =>
    request<{ ok: true }>(`/api/sites/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(site),
    }),
  remove: (name: string) =>
    request<{ ok: true }>(`/api/sites/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),
  start: (name: string) =>
    request<{ ok: true }>(`/api/sites/${encodeURIComponent(name)}/start`, {
      method: 'POST',
    }),
  stop: (name: string) =>
    request<{ ok: true }>(`/api/sites/${encodeURIComponent(name)}/stop`, {
      method: 'POST',
    }),
  restart: (name: string) =>
    request<{ ok: true }>(`/api/sites/${encodeURIComponent(name)}/restart`, {
      method: 'POST',
    }),
  importExisting: (name: string) =>
    request<{ ok: true }>(`/api/sites/${encodeURIComponent(name)}/import`, {
      method: 'POST',
    }),
};
