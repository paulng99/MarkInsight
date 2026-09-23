# MarkInsight Architecture

試卷成績分析 Web MVP — data model, pipeline, and tenancy notes for the scaffold.

## Scope reminder

- **In:** Web MVP shell, school-scoped RBAC, Prisma schema, analysis **job stub**, OpenRouter **LLM client stub**
- **Later (knife 1):** exam upload UI + real analysis job (OpenRouter multimodal)
- **Out of scope now:** native apps, school-wide reports, manual regrade, eClass sync, parents, billing

## Supplier decisions (locked)

| Supplier | Role | MVP |
|----------|------|-----|
| **[OpenRouter](https://openrouter.ai)** | All multimodal LLM calls: exam structure analysis + student submission scoring | **Required** |
| **[Jina](https://jina.ai)** | Possible later help for syllabus/PDF text extraction or embeddings | **Optional** — does not block scaffold or MVP acceptance |

First-version scoring stays **OpenRouter multimodal**. Do not gate MVP on Jina.

Scaffold code lives under `src/lib/llm/` (`LlmClient` interface + `OpenRouterLlmClient` stub). **No live API calls** in this stage — see TODOs on the client.

Env placeholders (never commit real keys): `OPENROUTER_API_KEY`, optional `OPENROUTER_*_MODEL`, optional `JINA_API_KEY` — see `.env.example`.

### Persist model id on every analysis result (locked)

Every exam-structure analysis and every submission scoring run **must** store the model id/name that produced the result:

| Location | Field | When |
|----------|-------|------|
| `AnalysisJob` | `llmModel` | Set when the job runs (structure or scoring); also `kind` = `EXAM_STRUCTURE` \| `SUBMISSION_SCORING` |
| `Exam` | `structureLlmModel` | Latest successful structure analysis |
| `Submission` | `scoringLlmModel` | Latest successful submission scoring |

LLM result DTOs (`AnalyzeExamStructureResult` / `ScoreSubmissionResult`) include required `llmModel` so workers copy it into those columns.

**Product UI must not show vendor names** (e.g. do not display “OpenRouter” / “Jina” to end users). Internal docs and env vars may name suppliers; user-facing copy stays vendor-neutral. If a model id is shown later for support/debug, show the model id string only — not the vendor brand.

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
- `kind`: `EXAM_STRUCTURE` | `SUBMISSION_SCORING`.
- `llmModel`: model id actually used for that run (required once started/succeeded).
- Scaffold runs **in-process**; replace with a real queue (e.g. Inngest / BullMQ / SQS) later.

### Exam / Submission model provenance

- `Exam.structureLlmModel` — model id for last successful structure analysis.
- `Submission.scoringLlmModel` — model id for last successful scoring.
- Mirror the same `llmModel` onto the related `AnalysisJob` row.

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
                     OpenRouter multimodal (LlmClient)  ← REQUIRED for MVP
                       • analyzeExamStructure → llmModel
                       • scoreSubmission → llmModel
                              │
                              ▼
                     Persist llmModel on AnalysisJob
                       + Exam.structureLlmModel / Submission.scoringLlmModel
                     QuestionScore rows + Submission.status=DONE
                              │
                              ▼
                     Refresh SubjectAggregate
```

Optional later: Jina for syllabus/PDF text / embeddings — **not** on the v1 scoring path. Product UI stays vendor-neutral.

**Knife 1 TODOs** (do not implement in this PR):

- Real multipart upload + storage adapter
- Queue-backed `enqueueAnalyzeExam` / `enqueueAnalyzeSubmission`
- Real `OpenRouterLlmClient.chat` (OpenAI-compatible `POST /chat/completions`) + structured extraction → `QuestionScore`
- Persist `llmModel` on `AnalysisJob` + `Exam.structureLlmModel` / `Submission.scoringLlmModel`
- Aggregate recompute + teacher/student read APIs
- Keep product UI free of vendor brand names

## Storage & LLM env

Placeholders live in `.env.example`:

- `DATABASE_URL`
- `STORAGE_*` — S3-compatible or local stub
- **`OPENROUTER_API_KEY`** (+ optional model / site vars) — required for MVP when live calls are wired
- **`JINA_API_KEY`** — optional; unused in scaffold
- Optional `FAL_KEY` — unused in scaffold

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
    llm/               # LlmClient + OpenRouter stub (no live calls)
    jobs/
      analyze-exam.ts  # In-process analysis job stub
prisma/schema.prisma   # Canonical data model
docs/architecture.md   # This document
```

## i18n

UI copy supports **English** and **繁體中文（香港）** (`zh-HK`). Default locale is configurable via `NEXT_PUBLIC_DEFAULT_LOCALE`.
