# MarkInsight Architecture

試卷成績分析 Web MVP — data model, pipeline, and tenancy notes for the scaffold.

## Scope reminder

- **In (this knife):** same-subject cross-exam weakness aggregation (課題 / 題型) from stored `QuestionScore` tags; student + teacher (class-scoped) UIs; empty state when &lt;2 SUCCEEDED analyses
- **Prior knives:** scaffold + admin school settings + exam upload / analysis jobs
- **Out of scope now:** school-wide reports, class-wide summary (optional), manual regrade, gamification, native apps, eClass sync, parents, billing, Jina-required path

## Supplier decisions (locked)

| Supplier | Role | MVP |
|----------|------|-----|
| **[OpenRouter](https://openrouter.ai)** | All multimodal LLM calls: exam structure analysis + student submission scoring | **Required** |
| **[Jina](https://jina.ai)** | Possible later help for syllabus/PDF text extraction or embeddings | **Optional** — does not block scaffold or MVP acceptance |

First-version scoring stays **OpenRouter multimodal**. Do not gate MVP on Jina.

Scaffold code lives under `src/lib/llm/` (`LlmClient` + `OpenRouterLlmClient`). Live calls use `OPENROUTER_API_KEY`. If the key is missing, jobs fail with a **vendor-neutral** message unless `MARKINSIGHT_ANALYSIS_DEMO=true` (deterministic offline results for local verify).

Env placeholders (never commit real keys): `OPENROUTER_API_KEY`, optional `OPENROUTER_*_MODEL`, optional `JINA_API_KEY`, `MARKINSIGHT_ANALYSIS_DEMO` — see `.env.example`.

### Persist model id on every analysis result (locked)

Every exam-structure analysis and every submission scoring run **must** store the model id/name that produced the result:

| Location | Field | When |
|----------|-------|------|
| `AnalysisJob` | `llmModel` | Set when the job runs (structure or scoring); also `kind` = `EXAM_STRUCTURE` \| `SUBMISSION_SCORING` |
| `Exam` | `structureLlmModel` | Latest successful structure analysis |
| `Submission` | `scoringLlmModel` | Latest successful submission scoring |

LLM result DTOs (`AnalyzeExamStructureResult` / `ScoreSubmissionResult`) include required `llmModel` so workers copy it into those columns.

**Product UI must not show vendor names** (e.g. do not display “OpenRouter” / “Jina” to end users). Internal docs and env vars may name suppliers; user-facing copy stays vendor-neutral. If a model id is shown later for support/debug, show the model id string only — not the vendor brand.

## School settings (admin-only, MVP)

`SchoolSettings` is **1:1** with `School` (`schoolId` PK). Admin read/write only — teachers and students must not access settings APIs or pages.

| Field | Purpose |
|-------|---------|
| `displayName` | School display name in product UI |
| `contactNote` | Optional contact note (no secrets) |
| `defaultSchoolYearId` | FK → `SchoolYear` (e.g. year name `2026-2027`) |
| `analysisLlmModel` | Model id from **`OPENROUTER_MODEL_ALLOWLIST`** only (not free-text) |
| `allowTeacherCreateStudents` | Toggle: teachers may create student accounts |
| `allowTeacherUploadOnBehalf` | Toggle: teachers may upload submissions for students |

**Model allowlist:** env `OPENROUTER_MODEL_ALLOWLIST` (comma-separated) or built-in `DEFAULT_OPENROUTER_MODEL_ALLOWLIST` in `src/lib/config/openrouter-model-allowlist.ts`. App-layer validation via `assertAllowedAnalysisModel`.

**Job behaviour:** new `AnalysisJob` rows use the school’s current `analysisLlmModel`. Past `AnalysisJob.llmModel` / `Exam.structureLlmModel` / `Submission.scoringLlmModel` values are **immutable history** — changing settings does not rewrite them.

**Hard rule:** `OPENROUTER_API_KEY` and `JINA_API_KEY` remain **env-only**. Never store keys in `SchoolSettings`, never expose them in UI or API responses.

**Implemented (settings knife):** Prisma persistence via `GET`/`PUT /api/admin/school-settings`, teacher create/list at `/api/admin/teachers`, school-year create at `/api/admin/school-years`, and the admin form at `/admin/settings` (single page, one save). Platform admin stub (`schoolId` null) resolves to `demo_school` and bootstraps School + default SchoolYear + SchoolSettings on first load. Teachers/students have no settings nav and receive 403 on settings APIs.

## High-level shape

```text
School
  ├── SchoolSettings (admin-only; analysisLlmModel from allowlist)
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
| `ADMIN` | Create **schools** and **teacher** accounts; **school settings** (read/write). Not a teaching workspace. |
| `TEACHER` | Manage class subjects, exams, uploads; view per-student cross-exam weak points for own class. No settings API access. |
| `STUDENT` | View own submissions and same-subject cross-exam aggregates. No settings API access. |

Auth in this scaffold is a **credentials stub** (NextAuth) with role-aware session claims. Production email / OAuth is not required for local demo — see README.

**Enforcement sketch (TODO):**

1. Session carries `userId`, `role`, `schoolId`.
2. Every DB read/write filters by `schoolId` (admins creating schools are the exception).
3. Teachers/students only see rows linked via `Enrollment` (or own `Submission`).
4. **School settings** routes/actions: `role === ADMIN` only (403 otherwise).

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
- `enrollmentId` null ⇒ class-wide (optional / not required this knife); set ⇒ per-student.
- Recomputed after successful submission scoring via `refreshSubjectAggregates` (true `examCount`, stale-row cleanup, classSubject-scoped).
- Live API `GET /api/class-subjects/[id]/weakness` aggregates DONE `QuestionScore` rows for the enrollment (prefer stored tags; no extra LLM).

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

**Done in upload/analyze knife:** multipart upload + local storage adapter; in-process `enqueueAnalyzeExam` / `enqueueAnalyzeSubmission` with Prisma `AnalysisJob` rows; real `OpenRouterLlmClient.chat` (+ demo mode); persist `llmModel`; teacher/student upload & result UIs with job status copy (排隊中 / 進行中 / 成功 / 失敗); RBAC on APIs.

## Storage & LLM env

Placeholders live in `.env.example`:

- `DATABASE_URL`
- `STORAGE_*` — S3-compatible or local stub
- **`OPENROUTER_API_KEY`** — env-only; never in DB/UI
- **`OPENROUTER_MODEL_ALLOWLIST`** — comma-separated ids for `SchoolSettings.analysisLlmModel`
- Optional `OPENROUTER_*_MODEL` / site vars
- **`JINA_API_KEY`** — optional; env-only; unused in scaffold
- Optional `FAL_KEY` — unused in scaffold

No secrets or real student scripts belong in the repository.

## App structure

```text
src/
  app/                 # App Router — landing, admin settings, teacher/student exam flows
  auth.ts              # NextAuth config (credentials stub)
    lib/
      prisma.ts
      rbac.ts
      errors.ts          # Vendor-neutral AppError helpers
      storage/           # Local object storage (MVP)
      demo-bootstrap.ts  # demo_school class + enrollments
      exams/service.ts   # Exam/submission RBAC helpers
      aggregates/        # Cross-exam weakness rollups (topic × itemType)
      i18n/              # en + zh-HK dictionaries
      config/
        openrouter-model-allowlist.ts
      school-settings/   # Admin settings helpers
      llm/               # LlmClient + OpenRouter client
      jobs/
        analyze-exam.ts  # In-process analysis job runner
        status-copy.ts   # Job status → UI copy keys
prisma/schema.prisma
docs/architecture.md
```

## i18n

UI copy supports **English** and **繁體中文（香港）** (`zh-HK`). Default locale is configurable via `NEXT_PUBLIC_DEFAULT_LOCALE`.

## Design tokens & motion (UX direction)

Scaffold tokens live in `src/app/globals.css` (CSS variables only — **no** Three.js / particle libs; Framer Motion optional later, not in this PR).

| Token group | Examples |
|-------------|----------|
| Primary / accent | `--color-primary`, `--color-accent` |
| Semantic | `--color-success`, `--color-warn`, `--color-error`, `--color-info` |
| Motion | `--motion-fast` 150ms, `--motion-base` 200ms, `--motion-slow` 300ms, `--motion-success` ≤500ms |

**Role-tiered motion** (applied on result UIs):

| Role | Motion intensity |
|------|------------------|
| Student | High (colorful chips, chart stub, success pop) |
| Teacher | Medium (half chroma / quieter motion) |
| Admin | Low |

**`prefers-reduced-motion`:** when set, skip decorative animation. Student/teacher result screens use CSS-only motion (no Framer Motion / 3D / gamification).
