# pm2-launcher — PLAN

Lokal web-app til at visualisere + styre PM2-processer på Christians Mac.
Selvkørende i PM2 på en låst port → auto-start ved Mac-reboot.

## Stack (samme som @webhouse/buddy)

- **Monorepo:** pnpm workspaces + Turbo
- **Backend:** Bun + Hono + Zod, taler med PM2 via `pm2` npm-pakkens programmatic API
- **Frontend:** Vite + Preact + Tailwind v4 (CSS-first) + shadcn/ui-komponenter (button, card, badge, input, modal)
- **Persistens:** Vores egen `ecosystem.config.cjs` (PM2's standardformat)
- **Bind:** kun `127.0.0.1` (local-only, ingen auth indtil videre)

## Layout

```
pm2-launcher/
├── apps/
│   ├── server/                 # Bun + Hono API + statisk web-bundle
│   │   ├── src/
│   │   │   ├── index.ts        # Hono app, bind 127.0.0.1
│   │   │   ├── pm2-client.ts   # promise-wrapper omkring `pm2` API
│   │   │   ├── ecosystem.ts    # read/write ecosystem.config.cjs
│   │   │   └── routes/sites.ts # CRUD + start/stop/restart/logs
│   │   └── package.json
│   └── web/                    # Vite + Preact UI
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/ui/  # button, card, badge, input, modal (shadcn-stil)
│       │   ├── components/site-card.tsx
│       │   ├── components/site-form.tsx
│       │   └── lib/api.ts      # fetch-wrapper
│       ├── styles.css          # Tailwind v4 @theme tokens (kopieret fra buddy)
│       └── package.json
├── packages/
│   └── shared/                 # zod-skemaer + TS-types
│       └── src/site.ts
├── scripts/
│   ├── install.sh              # første-gangs setup
│   └── lock-port.ts            # fetch + gem port via cl.broberg.dk
├── ecosystem.config.cjs        # vores master, indeholder pm2-launcher selv + alle launcher-managed sites
├── .pm2-launcher.json          # låst port + andre runtime settings
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Site-skema (`packages/shared/src/site.ts`)

```ts
export const SiteSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_-]+$/i),
  cwd: z.string().min(1),
  script: z.string().optional(),         // fx ".next/standalone/server.js" eller "src/index.ts"
  interpreter: z.string().optional(),    // 'node' | 'bun' | 'none' | osv
  args: z.string().optional(),           // fx "start -p 3010"
  port: z.number().int().min(1).max(65535).optional(),
  env: z.record(z.string()).default({}),
  autorestart: z.boolean().default(true),
  instances: z.number().int().min(1).default(1),
})
```

Auto-tilføjet ved write: `env.PM2_LAUNCHER = "1"` og `env.PORT = port` (hvis sat).

## Backend API (Hono, alle JSON, alle 127.0.0.1)

| Metode | Path | Formål |
|---|---|---|
| GET | `/api/sites` | Liste alle PM2-processer + flag `managedByLauncher` (env.PM2_LAUNCHER=1) |
| GET | `/api/sites/:name` | Detail (cpu, mem, restart count, uptime, log-paths) |
| POST | `/api/sites` | Opret: skriv til ecosystem.config.cjs + `pm2.start()` + `pm2 save` |
| PATCH | `/api/sites/:name` | Update: rewrite fil + `pm2.reload()` + `pm2 save` |
| DELETE | `/api/sites/:name` | `pm2.delete()` + fjern fra fil + `pm2 save` |
| POST | `/api/sites/:name/start` | `pm2.start(name)` |
| POST | `/api/sites/:name/stop` | `pm2.stop(name)` |
| POST | `/api/sites/:name/restart` | `pm2.restart(name)` |
| POST | `/api/sites/:name/import` | Adopter eksisterende PM2-process: skriv til vores ecosystem-fil, sæt `env.PM2_LAUNCHER=1`, reload |
| GET | `/api/sites/:name/logs?lines=200` | Tail af stdout+stderr |

## Self-hosting flow

`scripts/install.sh`:

1. `pnpm install && pnpm build` (bygger web → `apps/web/dist`)
2. Læs `.pm2-launcher.json` → hvis ingen `port` felter:
   - `curl -s https://cl.broberg.dk/api/vacant-port` → udtræk port
   - Gem `{ "port": <n> }` i `.pm2-launcher.json`
3. Generer/opdater `ecosystem.config.cjs` så den indeholder en entry:
   ```js
   {
     name: "pm2-launcher",
     cwd: "<repo>",
     script: "apps/server/src/index.ts",
     interpreter: "bun",
     env: { PORT: <låst>, PM2_LAUNCHER: "1", HOST: "127.0.0.1" },
     autorestart: true,
   }
   ```
4. POST til `cl.broberg.dk/api/apps/report-port` med repo-path + port
5. `pm2 start ecosystem.config.cjs --only pm2-launcher`
6. `pm2 save` (snapshot til `~/.pm2/dump.pm2`)
7. Print: "Open http://127.0.0.1:<port>"

`pm2 startup` har Christian allerede konfigureret (jeg har set `~/.pm2/launchagent-*.log`), så `pm2 save` er nok til boot-persistens.

## Frontend UI (Preact + shadcn-stil)

Layout (kopier buddys design-tokens og komponentstil):

- **Header:** "PM2 Launcher" + filter-toggle ("Vis kun launcher-managed" / "Vis alle"). Lille badge med antal.
- **Hovedview:** Card-grid (1-3 kolonner responsivt). Hvert kort viser:
  - Name (stort)
  - Status-badge (running=green / stopped=gray / errored=red)
  - Port (klikbart → åbner http://127.0.0.1:port i ny fane, hvis online)
  - CPU% og MEM-tal
  - Uptime (formatteret) + restart-count
  - Knapper: Start (hvis stopped) / Stop+Restart (hvis running) / Edit / Delete / "Import" (hvis ikke launcher-managed)
- **"+ New site"-knap** øverst → custom modal med form (alle felter fra skema). Ingen native `<select>`/`<input type="...">` der er problematiske — brug shadcn-komponenter.
- **Edit-knap** → samme modal med eksisterende værdier.
- **Delete** → custom bekræft-modal (aldrig `window.confirm`).
- **Toast-feedback** efter alle handlinger (succes/fejl).
- **Polling:** `GET /api/sites` hvert 3. sek (eller SSE — vi starter med polling).

## Boot-persistens (Mac-reboot)

PM2 launchAgent (`~/Library/LaunchAgents/io.keymetrics.PM2.plist`) er allerede installeret.
Efter `pm2 save` overlever processerne reboot. Pm2-launcher selv bliver tilføjet til samme dump → starter automatisk.

## Locked decisions (efter Christian-godkendelse)

1. **Persistens-fil:** `~/.pm2-launcher/ecosystem.config.cjs` (sammen med `~/.pm2-launcher/config.json`)
2. **Import:** eksplicit "Import"-knap på ikke-managed processer
3. **Logs:** SSE allerede i V1 (subscribe til `pm2.launchBus()` log-events)
