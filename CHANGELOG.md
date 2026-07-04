# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed
- Provisioned real Cloudflare resources and wired their IDs into `wrangler.toml`, replacing the
  scaffold placeholders:
  - **KV**: `kv-workers-ordering` namespace, bound as `KV`, id `1d6f3f196ccd41aa995fabc3f3250e21`
    (corrected after an initial `wrangler kv namespace create` produced a different namespace
    under another account; that one is unused).
  - **D1**: `d1-workers-ordering` database, bound as `DB`, id `25044be5-9272-41b9-9534-4da44fa4470e`
    (lives under a different Cloudflare account than the one this environment is authenticated
    as; an initial `wrangler d1 create` under the local account produced
    `86d0fdc9-a51d-49ff-8139-523b839a191d`, which is unused), replacing the placeholder
    `ordering_db` name.
- Updated `package.json` `db:migrate:*` / `db:seed:*` scripts to target `d1-workers-ordering`
  instead of the old placeholder `ordering_db` name.
- Updated `README.md` deploy instructions to reflect the actual provisioned resource names
  (`d1-workers-ordering`, `kv-workers-ordering`, `ordering-meal-images`) instead of generic
  placeholder commands.
- Re-applied local D1 migrations and seed data under the new database name/id so local dev
  (`npm run db:migrate:local`, `npm run db:seed:local`) continues to work.

## [0.1.0] - Initial commit

Initial implementation of the QR table ordering demo on Cloudflare Workers.

### Added
- **Worker (Hono) API** (`src/worker`):
  - `routes/auth.ts` — shared-password login for `chef`/`manager` roles, HMAC-signed session
    cookie (`lib/auth.ts`).
  - `routes/tables.ts` — manager table listing, QR/session token generation and regeneration
    (KV-backed), QR code rendered as SVG (`lib/qr.ts`).
  - `routes/menu.ts` — public menu listing (briefly cached in KV), chef CRUD for menu items,
    R2-backed meal photo upload/serve.
  - `routes/orders.ts` — customer order placement against an active table session.
  - `routes/chef.ts` — pending orders grouped by dish across tables, per-order "complete" action.
  - `routes/manager.ts` — live per-table status/pending totals, billing (closes session, records
    `daily_revenue`, issues a new QR token), and revenue dashboard.
  - `lib/db.ts`, `lib/tokens.ts`, `types.ts` — shared D1 query helpers, KV token pointer helpers,
    and `Env` bindings typing.
- **D1 schema** (`migrations/0001_init.sql`): tables, sessions, menu_items, orders, order_items,
  daily_revenue; seed data (`seed/seed.sql`) for 30 tables and sample menu items.
- **Frontend** (`src/frontend`, React + Vite + Tailwind):
  - `HomePage.tsx` — landing page linking to chef/manager dashboards.
  - `order/OrderPage.tsx` — customer-facing per-table menu browsing and order placement, gated by
    QR session token.
  - `chef/ChefPage.tsx` — password-gated dashboard with pending-orders tab (5s polling) and menu
    management tab (add/edit/delete items, toggle availability, upload photos).
  - `manager/ManagerPage.tsx` — password-gated dashboard with tables tab (QR generation, billing,
    5s polling) and revenue tab (30s polling).
  - `shared/api.ts`, `shared/useLogin.ts`, `shared/LoginForm.tsx` — shared fetch client and
    role-based login state/hook.
- **Tooling**: `wrangler.toml`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`,
  `tsconfig.json`, `package.json` scripts for dev/build/deploy/migrate/seed.
- `README.md` with setup, local dev, core flow, and deploy documentation.

### Fixed (during initial local verification)
- KV `expirationTtl` for the menu cache was below Cloudflare's 60-second minimum; raised from 30s
  to 60s.
- QR code generation used the `qrcode` package's canvas/PNG renderer, which requires a DOM/canvas
  unavailable in the Workers runtime; switched to dependency-free SVG rendering
  (`/api/tables/:number/qr.svg`).
