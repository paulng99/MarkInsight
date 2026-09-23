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
| Analysis **job stub** (in-process) | Parents / billing |
| Landing + empty role shells | Live LLM / OCR / charts / real upload UI |

**Roles (locked):**

- **Admin** — create schools + teacher accounts only
- **Teacher** — teaching workspace (exams / analysis later)
- **Student** — own results (later)

**Core later:** exam upload + multimodal LLM analysis; multi-exam weak-point aggregates via `topic` / `item_type` tags.

## Architecture

See **[docs/architecture.md](./docs/architecture.md)** for:

- Data model: School → SchoolYear → ClassSubject → Enrollment → Exam → Asset → Submission → QuestionScore → SubjectAggregate
- Upload → storage → job → LLM → DB pipeline
- `schoolId` tenancy + RBAC sketch

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- NextAuth (Auth.js v5) credentials stub — **no production email required** for local demo
- Prisma + PostgreSQL
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

Storage and LLM keys may stay empty; the scaffold does not call them.

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
- LLM / embedding / media placeholders (`LLM_*`, `EMBEDDING_*`, `FAL_KEY`)

**Do not commit real secrets or student PII.**

## Job stub

`src/lib/jobs/analyze-exam.ts` exposes in-process `enqueueAnalyzeExam` / `enqueueAnalyzeSubmission` helpers that log + return a fake job id.

```ts
// TODO(knife-1): replace with a real queue + multimodal LLM worker
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
src/lib/jobs/analyze-exam.ts
.env.example
```

## License

Private / TBD.
