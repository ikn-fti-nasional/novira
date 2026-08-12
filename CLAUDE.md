# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Novira is the web dashboard for **EcoVision**, a CCTV-based street litter detection system for local governments (see `README.md` for the product background). This repo is the SvelteKit admin dashboard: map of monitored cameras, live incident feed, area cleanliness ranking, and officer/notification management. Built with Svelte 5, Tailwind CSS v4, custom username/password session-based auth, and Drizzle ORM over Postgres (Neon).

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm check            # Type-check with svelte-check
pnpm check:watch      # Type-check in watch mode

pnpm db:generate      # Generate Drizzle migrations from schema
pnpm db:push          # Push schema changes directly to database
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:seed          # Seed database with sample data (npx tsx)

pnpm test             # Run all unit tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:e2e         # Run E2E tests (Playwright)

# Run a single test file
npx vitest run src/routes/\(app\)/users/users.test.ts

pnpm lint             # ESLint
pnpm format           # Prettier (write)
pnpm format:check     # Prettier (check only)
```

## Architecture

### Tech Stack

- **Svelte 5** with runes API (`$props`, `$state`, `$derived`, `{@render}`)
- **Tailwind CSS v4** — native CSS with `@theme` directive in `src/app.css`, no JS config file. OKLCH color system
- **shadcn-svelte** — UI components in `$lib/components/ui/`, added via `npx shadcn-svelte@latest add <component>`
- **Custom session auth** — SHA-256 hashed tokens with @oslojs/crypto, Argon2id password hashing
- **Drizzle ORM** — Postgres via `postgres` (postgres.js), pointed at a Neon connection string in production. Schema in `src/lib/server/db/schema.ts`
- **LayerChart v2** — D3-based charts. Marked `noExternal` in `vite.config.ts` alongside `svelte-ux` for SSR compatibility
- **Package manager:** pnpm

### Routing & Auth

Routes use SvelteKit route groups for layout separation:

- `(app)/` — Protected routes behind the app shell. Auth guard in `(app)/+layout.server.ts` redirects unauthenticated users to `/login`. Features: dashboard (`+page`), `cameras/`, `incidents/`, `hotspots/`, `area-ranking/`, `laporan-wilayah/`, `officers/`, `monitoring/`, `users/`, `roles/`, `content/` (CMS — list, `new/`, `[id]/edit/`), `analytics/`, `notifications/`, `database/`, `settings/`, `audit/`
- `(auth)/` — Public auth routes: `login/`, `register/`, `forgot-password/`, `reset-password/`, `lock/` (re-auth screen, requires an existing session)
- `(public)/` — Public marketing/landing pages
- `logout/` — Standalone logout action (server-only)
- `api/search/` — Search endpoint for command palette
- `sitemap.xml/` — Auto-generated sitemap

Session validation runs on every request via `hooks.server.ts`, populating `event.locals.user` and `event.locals.session`.

`event.locals.user` is `SessionUser` (a subset of `User` — no `passwordHash`, no timestamps). Use the full `User` type only when querying the DB directly.

Sessions live 30 days and auto-extend whenever a request arrives with <15 days remaining (logic in `validateSession`). The cookie holds the raw token; the DB stores its SHA-256 hash as the session ID — a leaked DB cannot be used to forge sessions.

The `(app)/+layout.server.ts` guard also enforces **maintenance mode**: when `appSettings.maintenanceMode === "true"`, non-admin users get a 503. Admins bypass it.

### Key Directories

- `src/lib/server/` — Server-only code (auth, database). Never import from client-side code
- `src/lib/server/auth.ts` — Session management (create, validate, invalidate, cookies)
- `src/lib/server/db/schema.ts` — Drizzle schema (users, sessions, pages, notifications, appSettings, passwordResetTokens)
- `src/lib/server/db/seed.ts` — Database seeder (run via `pnpm db:seed`, uses `npx tsx` not SvelteKit aliases)
- `src/lib/server/id.ts` — Crypto ID generator (`generateId()`)
- `src/lib/components/ui/` — shadcn-svelte components (don't edit directly, re-add to update)
- `src/lib/components/` — App-level components (sidebar, theme toggle, command palette, notification bell)
- `src/lib/hooks/` — Svelte 5 reactive utilities (e.g., `is-mobile.svelte.ts`)
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge) and component type utilities
- `src/lib/utils/` — Export utilities (CSV/JSON), user-agent parser

### Database

Database connection comes from `DATABASE_URL` (Postgres/Neon connection string, gitignored via `.env`). Roles enum: `admin | editor | viewer`. First registered user gets `admin` role.

**Notifications with `userId = NULL` are global** — every user sees them. Per-user notifications set `userId` to the recipient. The `(app)/+layout.server.ts` filter (`eq(userId, X) OR isNull(userId)`) is the canonical pattern for any notification query.

### Demo Mode

Gated by the `DEMO_MODE=true` env var (read directly via `process.env` in `settings/+page.server.ts`, not the DB). When enabled it unlocks two things that are otherwise invisible:

1. An admin-only **Demo tab in Settings** with a _Reset Demo Data Now_ button → the `resetDemo` action, which wipes and re-seeds the DB via `seedDemo()` from `seed.ts`.
2. A **self-modification guard on the shared `demo` account** — `updateProfile`/`changePassword` refuse to touch `username === "demo"` so one visitor can't lock everyone else out between resets.

Leave it unset on real deployments. For a hands-off public demo, an hourly cron runs `pnpm db:seed` (this is why deploy syncs `src/` too — see below).

### Testing

Tests co-locate with their route: e.g., `src/routes/(app)/users/users.test.ts` tests the `users/+page.server.ts` load and actions.

**Test DB pattern:** Tests mock `$lib/server/db/index.js` with a getter that returns an in-memory Postgres database (via [PGlite](https://pglite.dev/), a WASM Postgres) created via `await createTestDb()` from `test-utils.ts`. The mock must be set up before dynamically importing the server module:

```ts
vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));
const { load, actions } = await import("./+page.server.js");
```

After modifying `schema.ts`, also update the `SCHEMA_SQL` in `test-utils.ts` and run `pnpm db:push`.

`test-utils.ts` also exports `createTestUser(db, overrides)`, `createMockLocals(userId, role)`, `createFormData(entries)`, and `createMockRequest(formData)` — use these instead of hand-rolling fixtures in each test. `createTestUser` hashes `"password123"` with the same Argon2id parameters used in production.

### Patterns

- Forms use SvelteKit form actions with `use:enhance` for progressive enhancement
- Dark/light mode via `mode-watcher` — use `mode.current` (runes object), NOT `$mode`
- App shell layout: sidebar (`app-sidebar.svelte`) + topbar with breadcrumbs (generated from URL pathname)
- `App.Locals` typed in `src/app.d.ts` — `user: SessionUser | null`, `session: Session | null`
- `seed.ts` runs outside SvelteKit context — use relative imports (not `$lib/`) and `generateId()` from `$lib/server/id.js`
- LayerChart and `svelte-ux` must stay in `ssr.noExternal` in `vite.config.ts` — without it, SSR breaks on chart pages

### Deployment

Builds with `@sveltejs/adapter-node` (`pnpm build` → `build/`, run with `node build`). No deploy workflow is wired up yet — add one for your target host (Docker, a VPS with pm2, etc.) when the project is ready to ship. Local government pilots will most likely need on-premise/self-hosted deployment (see `README.md`), so plan the deploy target accordingly.
