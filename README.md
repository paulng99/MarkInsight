# MarkInsight

**試卷成績分析** — help teachers and students turn exam scripts into topic-level weak-point insight.

Web MVP (Next.js App Router + TypeScript + Prisma). This knife delivers **same-subject cross-exam weakness aggregation** (not a redo of settings or upload/analyze).

## Knife boundaries

| In this PR (cross-exam weakness) | Out of scope |
|----------------------------------|--------------|
| Same student + same subject + ≥2 SUCCEEDED analyses → topic / item_type rollup | School-wide reports |
| Student subject entry 「跨卷薄弱點」 + teacher per-student class-scoped view | Manual regrade / gamification |
| Empty state when &lt;2 successful analyses | Native apps / new vendors |
| Single-exam result pages stay primary | Reworking admin settings or upload/analyze |

**Roles (locked):**

- **Admin** — school settings + teacher accounts (already shipped)
- **Teacher** — open exam, upload assets, class results + per-student cross-exam weakness (own class)
- **Student** — upload own script, single-exam results, subject 「跨卷薄弱點」

## LLM / storage

| Piece | Behaviour |
|-------|-----------|
| Analysis model | New jobs read `SchoolSettings.analysisLlmModel` (allowlist) |
| Live multimodal | `OPENROUTER_API_KEY` → chat completions; product UI never shows vendor names |
| Missing key | Job fails with vendor-neutral copy (or set `MARKINSIGHT_ANALYSIS_DEMO=true` for offline deterministic results) |
| Model timeout | `MARKINSIGHT_LLM_TIMEOUT_MS` (default `120000`); timed-out jobs become **FAILED** with retry copy |
| Storage | `STORAGE_PROVIDER=local` → `.data/uploads` |
| Exam / script files | PDF, JPG, PNG only (extension + MIME checked server-side; HEIC rejected) |

Every successful analysis persists the model id on `AnalysisJob.llmModel` plus `Exam.structureLlmModel` or `Submission.scoringLlmModel`.

## Verify: teacher create → upload → student upload → results

```bash
npm install
cp .env.example .env
# set DATABASE_URL, NEXTAUTH_SECRET / AUTH_SECRET, NEXTAUTH_URL
# for local demo login with "password": set MARKINSIGHT_ANALYSIS_DEMO=true
# (.env.example defaults to false — you must set this manually)
npx prisma db push
# After a fresh clone, run `npx prisma generate` before `npm test`
# (generate is also part of `npm run build`).
npx prisma generate
npm run dev
```

**版本號：** 頁底顯示的版本來自 `package.json` 的 `version`（建置時注入）；發版時請先更新該欄位。可選地在建置環境設定 `GIT_COMMIT_SHA` 或 `NEXT_PUBLIC_APP_COMMIT` 以顯示短 SHA。

**Public deploy:** see **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**. Keep `MARKINSIGHT_ANALYSIS_DEMO=false` (or unset) so the legacy password cannot work; create real accounts with `npm run db:seed-admin`. There is no self-service password change — re-run the seed with new values to reset.

### Run with Docker (local laptop demo)

Requires Docker Compose and a root `.env` (copy from `.env.example`). Compose starts Postgres and the built Next.js app; it **overrides** `DATABASE_URL` to the Compose `db` service (does not use the optional local `markinsight-db` on port 5434).

For the classic demo (`password` + login-page hint), **set `MARKINSIGHT_ANALYSIS_DEMO=true` in `.env`** and leave `MARKINSIGHT_DEMO_PASSWORD` unset. The example file defaults to `false` so a public deploy cannot inherit the legacy password by accident.

```bash
cp .env.example .env   # if needed; set NEXTAUTH_SECRET / AUTH_SECRET
# echo 'MARKINSIGHT_ANALYSIS_DEMO=true' >> .env   # required for local demo login
docker compose up --build -d
# App: http://localhost:3000
docker compose logs -f web
```

### Public HTTPS (any Linux VPS)

Do **not** expose the app as plain `http://<ip>:3000` for a public site. Use a reverse proxy with HTTPS and set the public origin before starting Compose:

```bash
# NEXTAUTH_URL=https://markinsight.example.com
# AUTH_URL=https://markinsight.example.com
# MARKINSIGHT_ANALYSIS_DEMO=false   # required on a public URL
```

Follow **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** (Caddy／nginx, firewall, named volumes, first admin via `npm run db:seed-admin` inside the web container). After changing `.env`, recreate the web container: `docker compose -f docker-compose.prod.example.yml up -d --force-recreate web` (or the local demo compose file you are using).

```bash
docker compose down       # keep volumes
docker compose down -v    # wipe DB + upload volumes
```

Requires **Node.js 22+** for local `npm` workflows (see `.nvmrc` / `package.json` `engines`). Docker images pin Node 22 as well.
Then verify (local demo only — `MARKINSIGHT_ANALYSIS_DEMO=true`):

1. (Optional) Admin `admin@example.com` / `password` → School settings → pick analysis model + enable **Allow teachers to upload on behalf of students** → Save
2. Teacher `teacher@example.com` / `password` → **開卷** → create exam for class → upload question paper (PDF/image) → **Start structure analysis** → watch PENDING→排隊中 / RUNNING→進行中 / SUCCEEDED→成功 (or FAILED→失敗 + retry)
3. Student `student@example.com` / `password` → **上載答卷** → upload script → poll job states → **分析結果** (chips + expandable scores + chart stub; respects `prefers-reduced-motion`)
4. Teacher may proxy-upload only when settings allow; student sees only own submissions; other roles get **403** on foreign APIs
5. `npm run build` passes

Optional automated smoke (server running on :3000, `MARKINSIGHT_ANALYSIS_DEMO=true`):

```bash
node scripts/smoke-upload.cjs
```

### Smoke checklist (cross-exam weakness)

- With **&lt;2** DONE submissions in a subject: student/teacher see empty copy 「需再完成至少一份成功分析」 + link back to subject / upload
- With **≥2** DONE submissions for the same student + subject: 「跨卷薄弱點」 lists 課題 / 題型 ordered by weakness; topic drill links to related single-exam results
- Teacher opens per-student aggregation only for own class (`studentId` required); student cannot request another student’s aggregates
- Single-exam result page still works and links to cross-exam without replacing it
- No vendor brand names in UI / errors; `prefers-reduced-motion` respected; `npm run build` passes

## Architecture

See **[docs/architecture.md](./docs/architecture.md)**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- NextAuth (Auth.js v5) credentials stub
- Prisma + PostgreSQL
- Local object storage + in-process job runner (MVP)
- i18n: English + 繁體中文（香港）; dates **yyyy-mm-dd**

### Dev sign-in (local only)

Only when you have **manually** set `MARKINSIGHT_ANALYSIS_DEMO=true` and left `MARKINSIGHT_DEMO_PASSWORD` unset:

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `password` | Admin |
| `teacher@example.com` | `password` | Teacher |
| `student@example.com` | `password` | Student |

Demo teacher/student are upserted into Postgres on first workspace/exam API call (`demo_school`) **only while demo login is enabled**. On a public deploy with demo login disabled, use `npm run db:seed-admin` instead (see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)).

### 已知風險

登入頁目前公開示範帳戶與預設密碼（`password`）。正式給老師試用前必須重新評估（例如關閉示範登入、改為邀請制帳戶，或強制更換密碼）。

## License

Private / TBD.
