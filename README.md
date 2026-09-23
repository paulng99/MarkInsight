# MarkInsight

**試卷成績分析** — help teachers and students turn exam scripts into topic-level weak-point insight.

Web MVP (Next.js App Router + TypeScript + Prisma). This knife delivers **exam upload + analysis jobs** (not a settings redo).

## Knife boundaries

| In this PR (upload / analyze) | Out of scope |
|-------------------------------|--------------|
| Teacher create exam + paper/key upload | Manual regrade UI |
| Student script upload (+ teacher proxy when allowed) | School-wide reports |
| In-process analysis jobs + UI polling | Native apps / eClass / parents / billing |
| Results screens with job five-states | Jina as a required path |
| Persist `llmModel` on jobs / exam / submission | Reworking admin settings |

**Roles (locked):**

- **Admin** — school settings + teacher accounts (already shipped)
- **Teacher** — open exam, upload assets, trigger structure analysis, optional proxy upload, class results
- **Student** — upload own script, view own results only

## LLM / storage

| Piece | Behaviour |
|-------|-----------|
| Analysis model | New jobs read `SchoolSettings.analysisLlmModel` (allowlist) |
| Live multimodal | `OPENROUTER_API_KEY` → chat completions; product UI never shows vendor names |
| Missing key | Job fails with vendor-neutral copy (or set `MARKINSIGHT_ANALYSIS_DEMO=true` for offline deterministic results) |
| Storage | `STORAGE_PROVIDER=local` → `.data/uploads` |

Every successful analysis persists the model id on `AnalysisJob.llmModel` plus `Exam.structureLlmModel` or `Submission.scoringLlmModel`.

## Verify: teacher create → upload → student upload → results

```bash
npm install
cp .env.example .env
# set DATABASE_URL, NEXTAUTH_SECRET / AUTH_SECRET, NEXTAUTH_URL
# optional for offline success path: MARKINSIGHT_ANALYSIS_DEMO=true
npx prisma db push
npm run dev
```

1. (Optional) Admin `admin@example.com` / `password` → School settings → pick analysis model + enable **Allow teachers to upload on behalf of students** → Save
2. Teacher `teacher@example.com` / `password` → **開卷** → create exam for class → upload question paper (PDF/image) → **Start structure analysis** → watch PENDING→排隊中 / RUNNING→進行中 / SUCCEEDED→成功 (or FAILED→失敗 + retry)
3. Student `student@example.com` / `password` → **上載答卷** → upload script → poll job states → **分析結果** (chips + expandable scores + chart stub; respects `prefers-reduced-motion`)
4. Teacher may proxy-upload only when settings allow; student sees only own submissions; other roles get **403** on foreign APIs
5. `npm run build` passes

Optional automated smoke (server running on :3000, `MARKINSIGHT_ANALYSIS_DEMO=true`):

```bash
node scripts/smoke-upload.cjs
```

### Smoke checklist

- New analysis jobs use the admin-selected allowlisted model
- Failed upload / analysis shows clear error + retry (HK: 「請檢查檔案」 where appropriate); no vendor brand names in UI errors
- RBAC: student cannot read another student’s submission; teacher limited to own class; `schoolId` on all rows

## Architecture

See **[docs/architecture.md](./docs/architecture.md)**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- NextAuth (Auth.js v5) credentials stub
- Prisma + PostgreSQL
- Local object storage + in-process job runner (MVP)
- i18n: English + 繁體中文（香港）; dates **yyyy-mm-dd**

### Dev sign-in

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `password` | Admin |
| `teacher@example.com` | `password` | Teacher |
| `student@example.com` | `password` | Student |

Demo teacher/student are upserted into Postgres on first workspace/exam API call (`demo_school`).

## License

Private / TBD.
