# Design: Docker Compose (production-like) for MarkInsight

**Date:** 2026-09-25  
**Status:** Approved; implementation in progress / done per plan `docs/superpowers/plans/2026-09-25-docker-compose-prod.md`.

## Goal

Run MarkInsight with one command in a **production-like** layout: built Next.js app + PostgreSQL via Docker Compose. Not a hot-reload dev container.

## Non-goals

- In-container `next dev` / bind-mount source for live coding
- Single process packing Postgres + Node in one container
- Migrating or deleting the existing ad-hoc `markinsight-db` container (port 5434); it remains optional for local `npm run dev`

## Architecture

```
┌─────────────────────────────────────────┐
│  docker compose                         │
│  ┌─────────────┐    ┌─────────────────┐ │
│  │ db          │◄───│ web             │ │
│  │ postgres:16 │    │ next start :3000│ │
│  │ volume: pg  │    │ volume: .data   │ │
│  └─────────────┘    └─────────────────┘ │
└─────────────────────────────────────────┘
         ▲
         │ host :3000
```

### Services

| Service | Image / build | Host ports | Persistence |
|---------|---------------|------------|-------------|
| `db` | `postgres:16-alpine` | none required on host (internal `5432`); optional publish only if debugging | named volume `markinsight_pg` |
| `web` | build from repo `Dockerfile` | `3000:3000` | named volume `markinsight_data` → `/app/.data` |

### `web` image (multi-stage)

1. **deps:** `npm ci`
2. **build:** `prisma generate` + `next build` (enable Next.js `output: "standalone"` for a smaller runtime image)
3. **runner:** copy standalone output + Prisma schema/client bits needed at runtime; `CMD` runs entrypoint that:
   - waits for `db` health
   - `npx prisma db push` (MVP; no separate migrate service)
   - `node server.js` (standalone) or `next start`

### Configuration

- Compose loads project root `.env` (same keys as `.env.example`).
- Compose **overrides** `DATABASE_URL` for `web` to  
  `postgresql://markinsight:markinsight@db:5432/markinsight?schema=public`  
  so host `.env` pointing at `localhost:5434` does not break containers.
- Required for usable auth in container: `NEXTAUTH_SECRET` / `AUTH_SECRET`, and `AUTH_TRUST_HOST=true`.
- Set `NEXTAUTH_URL` to a stable public origin when you have one (`http://<droplet-ip>:3000` or `https://your.domain`). Loopback values such as `http://localhost:3000` are ignored at startup so sign-in uses the request host.
- LLM: pass through `OPENROUTER_*`, `MARKINSIGHT_ANALYSIS_DEMO`, etc. from `.env`.
- Storage: `STORAGE_PROVIDER=local`; data under `/app/.data` (uploads + exam-structure cache).

### Coexistence with current local setup

- Existing container `markinsight-db` on host **5434** is untouched.
- Compose `db` is a **separate** stack; do not map Compose Postgres to 5434 by default (avoid conflict). App talks to `db` on the Compose network only.
- Local `npm run dev` continues to use `.env` → `localhost:5434` as today.

## Files to add / change

| Path | Change |
|------|--------|
| `Dockerfile` | Multi-stage production image |
| `.dockerignore` | Exclude `node_modules`, `.next`, `.git`, `.data` (runtime volume), etc. |
| `docker-compose.yml` | `db` + `web`, healthcheck, volumes, env |
| `docker/entrypoint.sh` | Wait for DB → `prisma db push` → start server |
| `next.config.ts` | `output: "standalone"` |
| `README.md` | Short “Run with Docker” section |
| `.env.example` | Note Compose `DATABASE_URL` override / compose usage |

## Operator commands

```bash
# Ensure .env exists (from .env.example) with secrets + optional OPENROUTER_API_KEY
docker compose up --build -d
# App: http://localhost:3000

docker compose logs -f web
docker compose down          # stop; keep volumes
docker compose down -v       # stop and wipe DB + .data volumes
```

## Success criteria

- Fresh machine with Docker + `.env`: `docker compose up --build -d` yields a working login page on `:3000`.
- Schema applied without manual `prisma` on the host.
- Uploads survive `docker compose restart`.
- Stopping Compose does not require deleting the old `markinsight-db` container.

## Risks / notes

- `prisma db push` on every start is acceptable for MVP; later replace with migrate deploy if migrations are introduced.
- Standalone build must include Prisma engines; entrypoint must use matching generated client.
- First build is slower than `npm run dev`; expected for production-like images.
