# Docker Compose Production-like Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-command production-like MarkInsight stack via Docker Compose (`web` + `db`).

**Architecture:** Multi-stage Next.js standalone image; Postgres 16; entrypoint waits for DB, runs `prisma db push`, then starts the server; volumes for PG data and `/app/.data`.

**Tech Stack:** Docker Compose, Next.js 16 standalone, Prisma 6, PostgreSQL 16 Alpine.

## Global Constraints

- Production-like only (no `next dev` in Compose).
- Do not remove or remount existing host `markinsight-db` on 5434.
- Compose overrides `DATABASE_URL` to `db:5432`.
- i18n en / zh-HK unchanged; no vendor names in product UI.

---

## File map

| File | Responsibility |
|------|----------------|
| `next.config.ts` | `output: "standalone"` |
| `Dockerfile` | Multi-stage build + runner |
| `.dockerignore` | Slim build context |
| `docker/entrypoint.sh` | DB wait + schema push + start |
| `docker-compose.yml` | `db` + `web` services |
| `README.md` / `.env.example` | Operator docs |

---

### Task 1: Standalone Next config + ignore

- [ ] Set `output: "standalone"` in `next.config.ts`
- [ ] Add `.dockerignore`
- [ ] Verify: `npx next build` still succeeds (or defer to Task 3 image build)

### Task 2: Dockerfile + entrypoint

- [ ] Write `Dockerfile` (node:20-alpine, deps → builder → runner with Prisma CLI for `db push`)
- [ ] Write `docker/entrypoint.sh` (pg_isready loop or TCP wait → `prisma db push` → `node server.js`)
- [ ] Runner must include `prisma/` schema and generated client / engines

### Task 3: Compose + docs

- [ ] Write `docker-compose.yml` (`db` healthcheck, `web` depends_on, ports 3000, volumes, env_file)
- [ ] Update `README.md` and `.env.example` with Compose notes
- [ ] Stop host process on :3000 if needed; `docker compose up --build -d`
- [ ] Verify: HTTP 200/302 on `http://localhost:3000`; login page loads

### Task 4: Spec status

- [ ] Mark design doc status as implemented
