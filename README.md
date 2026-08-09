# Novira

**Web dashboard for EcoVision — a CCTV-based street litter detection system for local governments.**

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)

Novira turns a local government's existing CCTV network — hardware that's already installed and mostly idle — into an automatic cleanliness sensor. Instead of waiting for citizen reports, it detects trash piles as they appear, times how long they sit uncollected, and gives the sanitation department (DLH/Dinas Kebersihan) a live map, an SLA to enforce, and a leaderboard to rank neighborhoods by cleanliness.

This repository is the **admin dashboard** — the piece operators, field officers, and department heads actually look at. The detection pipeline (YOLOv8 + ByteTrack on RTSP streams) is a separate service that talks to this app over an API.

## Why

Indonesia produces roughly 68 million tons of waste per year, and most cities have no real-time visibility into where trash accumulates or how long it's left there. Handling is reactive (wait for a citizen report) and unmeasured (no SLA). Novira's pitch to a local government is simple: **turn the CCTV you already have into a 24/7 digital sanitation officer, with no new cameras required.**

| Problem | Today | With Novira |
| --- | --- | --- |
| No visibility into illegal dumping spots | Manual patrols / waiting for reports | Automatic 24/7 detection from existing CCTV |
| No measure of how long trash sits | Untracked | Automatic timer per trash pile (SLA) |
| Sanitation crew performance is unmeasured | Manual, unreliable reporting | Response-time dashboard per area |
| No evidence of illegal dumping | Hard to act on | Automatic event clip when trash appears |
| No ranking of area cleanliness | Adipura award, once a year | Real-time cleanliness score per neighborhood |

## Who uses it

- **DLH admin (primary)** — monitors the dashboard, assigns officers, verifies detections.
- **Field officers** — receive notifications about new incidents (mobile view / WhatsApp).
- **Department head / mayor** — views neighborhood rankings, monthly reports, KPIs.
- **General public (phase 2)** — a public dashboard showing area cleanliness scores (transparency + friendly competition between neighborhoods).

## What this dashboard does

- **Live incident map** — every camera plotted with active trash markers (red = over 24h, yellow = under 24h).
- **Camera monitoring** — live view per camera with detection overlays.
- **Incident table** — location, snapshot, duration, status, "mark resolved" / assign-to-officer actions. Admins can flag false positives, which feeds back into model retraining.
- **Area ranking** — a 0–100 cleanliness score per neighborhood, based on incident count, average time-to-clean, and weekly trend — the basis for a leaderboard between neighborhoods.
- **Officer & notification management** — who gets alerted, and the SLA-breach escalation path.
- **Reporting** — per-area reports for department review.

The detection side (what the model actually does, dataset strategy, tracking/persistence logic, and privacy/legal constraints on face and license-plate data) is documented separately in the product PRD — ask a maintainer if you need it.

## Tech stack (this repo)

- **SvelteKit 2** + **Svelte 5** (runes API)
- **Tailwind CSS v4** with `shadcn-svelte` components
- **Drizzle ORM** over SQLite (swap for Postgres/PostGIS as the system scales — see below)
- Custom session-based auth (Argon2id) with optional Google/GitHub OAuth via Arctic
- **LayerChart** (D3-based) for charts

> Note: the broader EcoVision system plan (inference service, message queue, object storage, notifications) targets Python/FastAPI for inference and PostgreSQL + PostGIS for geospatial data at production scale. This dashboard can be pointed at that stack once the API contract is in place; SQLite is fine for local development and small pilots.

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in ORIGIN and, optionally, OAuth credentials
pnpm db:push               # create the local SQLite schema
pnpm db:seed                # optional: seed sample data
pnpm dev
```

Other useful commands:

```bash
pnpm build            # production build
pnpm preview           # preview the production build
pnpm check              # type-check
pnpm test                # unit tests (Vitest)
pnpm test:e2e            # E2E tests (Playwright)
pnpm lint                # ESLint
pnpm format               # Prettier (write)
```

See `CLAUDE.md` for a deeper architecture walkthrough (routing, auth, database, testing patterns).

## Roadmap

- **Phase 1 (MVP)** — real-time detection, trash-duration tracking, event recording, this dashboard, area ranking, WhatsApp/Telegram notifications.
- **Phase 2** — trash-type classification (organic/inorganic/hazardous), public cleanliness dashboard, automated monthly PDF reports, dumping-vehicle detection, volume estimation.
- **Phase 3 ("Indonesia Go Green")** — open Green Score API, waste-bank integration (turning detected inorganic waste into a circular-economy opportunity for registered waste pickers), estimated CO₂e impact reporting, hybrid citizen photo reports, predictive patrol scheduling.

## Privacy note

Novira is explicitly **not** a face-recognition system. Event clips exist as evidence that dumping occurred; identifying a person is left to authorized officers (Satpol PP) through official procedure, never automated. The public dashboard shows aggregate data only (counts, scores, locations) — no raw video or snapshots. Faces and license plates visible in non-case snapshots are auto-blurred, and clips/snapshots are retained for a limited period unless flagged as an active case.
