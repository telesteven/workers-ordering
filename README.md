# QR Table Ordering — Cloudflare Workers Demo

A restaurant ordering demo built entirely on Cloudflare's edge platform: customers order via a
per-table QR code, chefs manage the menu and kitchen queue, and managers track pending orders,
billing, and daily revenue.

## Stack

- **Frontend**: React + Vite SPA (TailwindCSS), served as static assets by the Worker.
- **Backend**: Single Cloudflare Worker using [Hono](https://hono.dev).
- **D1**: source of truth — tables, sessions, menu items, orders, order items, daily revenue.
- **KV**: table QR tokens (session lookup) + short-lived menu cache.
- **R2**: chef-uploaded meal photos.
- **Auth**: shared password per role (chef/manager), HMAC-signed session cookie.

## Project Structure

```
src/
  worker/           Hono API (routes, lib helpers, types)
  frontend/          React app: HomePage, /order/:table, /chef, /manager
migrations/          D1 schema migrations (managed by wrangler)
seed/                One-off seed data (6 tables + sample menu items)
```

## Prerequisites

- Node.js 18+
- A Cloudflare account (for `remote`/deploy commands)

## Local Development

```bash
npm install

# Apply schema + seed 6 tables and sample menu items to the local D1 simulator
npm run db:migrate:local
npm run db:seed:local

# Build the frontend once (wrangler dev serves the built dist/ as static assets)
npm run build

# Start the Worker (serves API + built frontend) on http://localhost:8787
npm run worker:dev
```

Local secrets live in `.dev.vars` (already created, git-ignored):

```
CHEF_PASSWORD=chef123
MANAGER_PASSWORD=manager123
SESSION_SECRET=local-dev-secret-change-me
```

Open `http://localhost:8787`:
- **Chef Dashboard**: `/chef` (password `chef123`)
- **Manager Dashboard**: `/manager` (password `manager123`)
- **Customer ordering**: generate a table's QR from the Manager Dashboard → "Generate QR", then
  visit the encoded `/order/<table>?token=...` URL (or scan the QR image).

> For frontend-only iteration with hot reload, `npm run dev` starts a Vite dev server on 5173
> that proxies `/api/*` to `http://127.0.0.1:8787` — run `npm run worker:dev` in another terminal
> first.

## Core Flow

1. **Manager** generates a QR/session for a table. This creates a `sessions` row + KV token
   pointing to that table.
2. **Customer** scans the QR, browses the menu (cached briefly in KV), and places one or more
   orders against that session.
3. **Chef** sees pending order items grouped by dish (for kitchen efficiency) with a per-table
   breakdown, and marks orders "Completed" once cooked/served.
4. **Manager** sees live per-table pending totals, and clicks "Bill / Close" once the table is
   ready to pay. This records the session's total into `daily_revenue`, closes the old session,
   and generates a **new** QR/token for that table automatically.
5. **Manager** revenue dashboard shows today's total per table and grand total (accrues only on
   billing, polled every 30s). Chef pending view polls every 5s.

## Deploying to Cloudflare

1. Cloudflare resources are already provisioned and referenced by ID in `wrangler.toml`:
   - D1: `d1-workers-ordering`
   - KV: `kv-workers-ordering`
   - R2: `ordering-meal-images`

   If you need to (re)create any of these under your own account, run:
   ```bash
   npx wrangler d1 create d1-workers-ordering
   npx wrangler kv namespace create kv-workers-ordering
   npx wrangler r2 bucket create ordering-meal-images
   ```
   Then update the `database_id` / `id` fields in `wrangler.toml` with the values printed above.

2. Apply migrations + seed data to the remote database:
   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote
   ```
   If the database was previously seeded with 30 tables (before the table count was reduced to
   6), run the one-off cleanup script to remove tables 7-30 and their historical
   sessions/orders/revenue rows:
   ```bash
   npm run db:prune-tables:remote
   ```

3. Set secrets:
   ```bash
   npx wrangler secret put CHEF_PASSWORD
   npx wrangler secret put MANAGER_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```

4. Build and deploy:
   ```bash
   npm run deploy
   ```

## Notes / Known Limitations (demo scope)

- QR codes are rendered as SVG (no native canvas dependency needed in the Workers runtime).
- Real-time updates use polling (5s chef / 30s manager) per project requirements, not
  WebSockets/Durable Objects.
- Session cookies use `Secure`, so in production they require HTTPS (Cloudflare Workers serve
  HTTPS by default); `localhost` is treated as a secure context by browsers for local dev.
