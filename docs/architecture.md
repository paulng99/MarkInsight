# MarkInsight Architecture

試卷成績分析 Web MVP — data model, pipeline, and tenancy notes for the scaffold.

## Scope reminder

- **In:** Web MVP shell, school-scoped RBAC, Prisma schema, analysis **job stub**
- **Later (knife 1):** exam upload UI + real analysis job (multimodal LLM)
- **Out of scope now:** native apps, school-wide reports, manual regrade, eClass sync, parents, billing

## High-level shape

```text
School
  └── SchoolYear
        └── ClassSubject
              ├── Enrollment (teacher | student)
              └── Exam
                    ├── Asset (question paper / answer key / student script)
                    └── Submission
                          └── QuestionScore (topic, item_type, score)
              └── SubjectAggregate (topic × item_type rollups)
```

Almost every table includes `schoolId` so queries can enforce a **tenant boundary**.

## Roles & RBAC

| Role | Capabilities (product intent) |
|------|--------------------------------|
| `ADMIN` | Create **schools** and **teacher** accounts only. Not a teaching workspace. |
| `TEACHER` | Manage class subjects, exams, uploads; view class/student weak points (later). |
| `STUDENT` | View own submissions and aggregates (later). |

Auth in this scaffold is a **credentials stub** (NextAuth) with role-aware session claims. Production email / OAuth is not required for local demo — see README.

**Enforcement sketch (TODO):**

1. Session carries `userId`, `role`, `schoolId`.
2. Every DB read/write filters by `schoolId` (admins creating schools are the exception).
3. Teachers/students only see rows linked via `Enrollment` (or own `Submission`).

## Data model notes

### School → SchoolYear → ClassSubject

- `School` is the tenant root.
- `SchoolYear` uses calendar dates (`startsOn` / `endsOn`); UI date format is **yyyy-mm-dd**.
- `ClassSubject` is a taught cohort (e.g. `3A` + `MATH`).

### Enrollment

- Links a `User` to a `ClassSubject` as `TEACHER` or `STUDENT`.
- Unique on `(classSubjectId, userId)`.

### Exam → Asset → Submission → QuestionScore

- `Exam` belongs to one `ClassSubject`.
- `Asset` stores **object-storage keys** only (no blobs / no sample PII exams in repo).
- `Submission` is one student attempt; status drives the analysis pipeline.
- `QuestionScore` holds scored items with **`topic`** and **`itemType`** tags — the join keys for multi-exam weak-point aggregates.

### SubjectAggregate

- Subject-level rollups by `(topic, itemType)`.
- `enrollmentId` null ⇒ class-wide; set ⇒ per-student.
- Recomputed by jobs after analysis completes (implementation TODO).

### AnalysisJob

- Persisted job row for observability.
- Scaffold runs **in-process**; replace with a real queue (e.g. Inngest / BullMQ / SQS) later.

## Upload → storage → job → LLM → DB pipeline

```text
[Teacher upload] ──► [Object storage] ──► Asset(storageKey)
                              │
                              ▼
                     AnalysisJob (PENDING)
                              │
                              ▼
                     Worker / stub enqueue
                              │
                              ▼
                     Multimodal LLM (TODO; no live calls in scaffold)
                              │
                              ▼
                     QuestionScore rows + Submission.status=DONE
                              │
                              ▼
                     Refresh SubjectAggregate
```

**Knife 1 TODOs** (do not implement in this PR):

- Real multipart upload + storage adapter
- Queue-backed `enqueueAnalyzeExam` / `enqueueAnalyzeSubmission`
- LLM provider client (OpenRouter / etc.) with structured extraction → `QuestionScore`
- Aggregate recompute + teacher/student read APIs

## Storage & LLM env

Placeholders live in `.env.example`:

- `DATABASE_URL`
- `STORAGE_*` — S3-compatible or local stub
- `LLM_*` / optional `EMBEDDING_*` / `FAL_KEY`

No secrets or real student scripts belong in the repository.

## App structure (scaffold)

```text
src/
  app/                 # App Router pages (landing + role shells)
  auth.ts              # NextAuth config (credentials stub)
  lib/
    prisma.ts          # Prisma client singleton
    rbac.ts            # Role helpers + TODO enforcement notes
    i18n/              # en + zh-HK dictionaries
    jobs/
      analyze-exam.ts  # In-process analysis job stub
prisma/schema.prisma   # Canonical data model
docs/architecture.md   # This document
```

## i18n

UI copy supports **English** and **繁體中文（香港）** (`zh-HK`). Default locale is configurable via `NEXT_PUBLIC_DEFAULT_LOCALE`.
