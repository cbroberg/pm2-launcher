# pm2-launcher

Lokal web-app der visualiserer + styrer PM2-processer på din Mac.
Selvkørende i PM2 på en låst port — overlever Mac-reboot via `pm2 save`.

## Stack

- **Backend:** Bun + Hono, `pm2` programmatic API
- **Frontend:** Vite + Preact + Tailwind v4 + shadcn-stil komponenter
- **Monorepo:** pnpm workspaces + Turbo

## Installation

```bash
pnpm install
pnpm build
pnpm install:pm2
```

Det `install:pm2`-script:

1. Henter en ledig port via `cl.broberg.dk/api/vacant-port` (kun første gang) og gemmer den i `~/.pm2-launcher/config.json`.
2. Skriver `~/.pm2-launcher/ecosystem.config.cjs` med launcher-entry'en (bevarer andre apps i samme fil).
3. Starter/reloader `pm2-launcher` i PM2 og kører `pm2 save` så processen genstarter ved Mac-reboot.

UI'et er på `http://127.0.0.1:<port>`. Porten printes ved install og findes også i `~/.pm2-launcher/config.json`.

## Udvikling

```bash
# starter både Bun-server (4173) og Vite-dev (4174 m. proxy til /api)
pnpm dev
```

Vite-dev kører på `http://127.0.0.1:4174` og proxyr `/api` → server.

## Filstier

| Sti | Indhold |
|---|---|
| `~/.pm2-launcher/config.json` | Låst port + host |
| `~/.pm2-launcher/ecosystem.config.cjs` | PM2 ecosystem-fil; alle launcher-managed apps lever her |
| `apps/server/src/` | Hono API + SSE log-stream |
| `apps/web/src/` | Preact UI |
| `packages/shared/src/` | Zod-schemaer delt mellem server og web |

## API

| Metode | Path | Beskrivelse |
|---|---|---|
| GET | `/api/sites` | Liste alle PM2-processer + flag `managedByLauncher` |
| GET | `/api/sites/:name` | Detail |
| POST | `/api/sites` | Opret site (skriver ecosystem + `pm2 start` + `pm2 save`) |
| PATCH | `/api/sites/:name` | Opdater (delete + restart) |
| DELETE | `/api/sites/:name` | Slet (stopper PM2 + fjerner fra ecosystem) |
| POST | `/api/sites/:name/{start,stop,restart}` | Lifecycle |
| POST | `/api/sites/:name/import` | Adopter eksisterende PM2-proces under launcher |
| GET | `/api/sites/:name/logs` | SSE-stream af logs (history + live) |

Server binder kun `127.0.0.1` — ingen auth indtil videre.
