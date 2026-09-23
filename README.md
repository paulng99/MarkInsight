# MarkInsight

**試卷成績分析** — help teachers and students turn exam scripts into topic-level weak-point insight.

Web-only MVP scaffold (Next.js App Router + TypeScript + Prisma). Full upload/LLM product features are intentionally **not** implemented yet.

## MVP scope (this repo stage)

| In scope now | Out of scope (for later) |
|--------------|--------------------------|
| Product docs + architecture | Native iOS/Android |
| Next.js app that builds | School-wide reports |
| Role-aware auth **stubs** (admin / teacher / student) | Manual regrade UI |
| Prisma schema (`school_id` tenant) | eClass sync |
| Analysis **job stub** + OpenRouter **LLM client stub** | Parents / billing |
| Landing + empty role shells | Live LLM / OCR / charts / real upload UI |

**Roles (locked):**

- **Admin** — create schools + teacher accounts only
- **Teacher** — teaching workspace (exams / analysis later)
- **Student** — own results (later)

**Core later:** exam upload + multimodal LLM analysis; multi-exam weak-point aggregates via `topic` / `item_type` tags.

## LLM suppliers (locked)

| Supplier | Use | MVP |
|----------|-----|-----|
| **OpenRouter** | All multimodal LLM calls — exam structure analysis + student submission scoring (OpenAI-compatible API) | **Required** |
| **Jina** | Optional later help for syllabus/PDF text extraction or embeddings | **Optional** — does not block scaffold or MVP |

Scaffold wires an `LlmClient` interface with an `OpenRouterLlmClient` stub under `src/lib/llm/`. **No live API calls** in this PR. Put placeholders only in `.env.example` — never commit real keys.

Every analysis result must persist the **model id** used (`AnalysisJob.llmModel`, `Exam.structureLlmModel`, `Submission.scoringLlmModel`). **Product UI must not show vendor names.**

**School settings (admin-only):** `SchoolSettings` holds display name, contact note, default school year, allowlisted `analysisLlmModel`, and teacher toggles. API keys stay in env — never in DB/UI. See `docs/architecture.md`.

## Architecture

See **[docs/architecture.md](./docs/architecture.md)** for:

- Data model: School → SchoolYear → ClassSubject → Enrollment → Exam → Asset → Submission → QuestionScore → SubjectAggregate
- Upload → storage → job → **OpenRouter** → DB pipeline
- `schoolId` tenancy + RBAC sketch

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- NextAuth (Auth.js v5) credentials stub — **no production email required** for local demo
- Prisma + PostgreSQL
- OpenRouter (required for MVP LLM; stubbed here)
- i18n: English + 繁體中文（香港）; dates **yyyy-mm-dd**

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted)
- npm

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Fill at least:

- `DATABASE_URL` — Postgres connection string
- `NEXTAUTH_SECRET` — random string (`openssl rand -base64 32`)
- `NEXTAUTH_URL` — `http://localhost:3000`

Storage / OpenRouter / Jina keys may stay empty; the scaffold does not call them. When wiring knife 1, set `OPENROUTER_API_KEY` (required for live multimodal calls).

### 3. Database

Push the schema (good for local scaffold) **or** create a migration:

```bash
# Option A — prototype / local
npx prisma db push

# Option B — versioned migration
npx prisma migrate dev --name init
```

Generate the client (usually automatic after install/push):

```bash
npx prisma generate
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Auth stub (dev)

Sign-in uses **demo credentials** (no email provider):

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `password` | Admin |
| `teacher@example.com` | `password` | Teacher |
| `student@example.com` | `password` | Student |

These users are **in-memory stubs** — they are not seeded into Postgres. Wire real `User` rows + password hashes before production.

### Build check

```bash
npm run build
```

## Environment variables

See **[.env.example](./.env.example)** for the full list. Groups:

- App / NextAuth (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, locale)
- `DATABASE_URL`
- Object storage placeholders (`STORAGE_*`)
- **OpenRouter (required for MVP):** `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, **`OPENROUTER_MODEL_ALLOWLIST`**, optional `OPENROUTER_EXAM_STRUCTURE_MODEL` / `OPENROUTER_SCORING_MODEL`
- **Jina (optional):** `JINA_API_KEY` — not required for scaffold or v1 scoring; env-only
- Optional `FAL_KEY`

**Do not commit real secrets or student PII. Never put API keys in `SchoolSettings` or the UI.**

## Job + LLM stubs

- `src/lib/jobs/analyze-exam.ts` — in-process enqueue stub (resolves `createLlmClient()`, no HTTP)
- `src/lib/llm/` — `LlmClient` + `OpenRouterLlmClient` targeting `https://openrouter.ai/api/v1`

```ts
// TODO(knife-1): real queue + OpenRouter chat/completions → QuestionScore
```

## Project layout

```text
docs/architecture.md
prisma/schema.prisma
src/app/                 # landing + /admin /teacher /student shells
src/auth.ts              # NextAuth config
src/lib/prisma.ts
src/lib/rbac.ts
src/lib/i18n/
src/lib/config/openrouter-model-allowlist.ts
src/lib/school-settings/
src/lib/llm/             # OpenRouter LlmClient stub
src/lib/jobs/analyze-exam.ts
src/app/admin/settings/  # settings UI stub (TODO form)
.env.example
```

## License

Private / TBD.
