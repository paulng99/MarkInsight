"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { countLabel, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";

type StructureQuestion = {
  questionKey: string;
  topic: string;
  itemType: string;
  questionCategory?: string;
  maxScore: number;
  assessmentObjective?: string;
  difficultyPoints?: string;
};

type ExamDetail = {
  id: string;
  title: string;
  examDate: string;
  classSubject: { id: string; name: string; subjectCode: string };
  structureLlmModel: string | null;
  structureQuestions: StructureQuestion[];
  assets: Array<{
    id: string;
    kind: string;
    originalName: string | null;
    mimeType: string | null;
  }>;
  latestStructureJobs: Array<{
    id: string;
    status: string;
    errorMessage: string | null;
  }>;
};

export function TeacherExamDetail({
  locale,
  t,
  examId,
}: {
  locale: Locale;
  t: Dictionary;
  examId: string;
}) {
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadKind, setUploadKind] = useState<"QUESTION_PAPER" | "ANSWER_KEY">(
    "QUESTION_PAPER",
  );
  const [fileReset, setFileReset] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/${examId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.stateError);
        return;
      }
      setExam({
        ...data.exam,
        structureQuestions: data.exam.structureQuestions ?? [],
      });
      setJobId(data.exam.latestStructureJobs?.[0]?.id ?? null);
      setError(null);
    } catch {
      setError(t.stateError);
    }
  }, [examId, t.stateError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onStructureSucceeded = useCallback(() => {
    setBanner(t.examStructureReady);
    void load();
  }, [load, t.examStructureReady]);

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("kind", uploadKind);
    setBanner(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/assets`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner(data.error || t.uploadError);
          return;
        }
        setBanner(t.uploadSuccess);
        form.reset();
        setFileReset((n) => n + 1);
        await load();
      } catch {
        setBanner(t.uploadError);
      }
    });
  }

  function startAnalyze() {
    setBanner(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/analyze`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner(data.error || t.examAnalyzeError);
          return;
        }
        setJobId(data.jobId);
        setBanner(t.examAnalyzeSuccess);
        await load();
      } catch {
        setBanner(t.examAnalyzeError);
      }
    });
  }

  async function retryJob() {
    if (!jobId) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setJobId(data.jobId);
      setBanner(t.examAnalyzeSuccess);
    } else {
      setBanner(data.error || t.examAnalyzeError);
    }
  }

  if (error && !exam) {
    return (
      <Alert
        tone="error"
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            <Icon.Refresh size={14} />
            {t.settingsRetry}
          </button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24" />
        <LoadingBlock label={t.stateLoading} />
      </div>
    );
  }

  const questions = exam.structureQuestions ?? [];
  const latest = exam.latestStructureJobs[0];
  const jobSucceeded = latest?.status === "SUCCEEDED";
  const hasPaper = exam.assets.length > 0;
  const isSuccessBanner =
    banner === t.uploadSuccess ||
    banner === t.examAnalyzeSuccess ||
    banner === t.examStructureReady;

  const step = !hasPaper ? 0 : !jobSucceeded ? 1 : 2;
  const nextStepCopy = [t.nextStepUploadPaper, t.nextStepAnalyse, t.nextStepDistribute][step];

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: t.navDashboard, href: `/teacher?locale=${locale}` },
          { label: exam.classSubject.subjectCode },
          { label: exam.title },
        ]}
        eyebrow={`${exam.classSubject.name} · ${exam.classSubject.subjectCode}`}
        title={exam.title}
        description={`${t.dateLabel}: ${exam.examDate}`}
        actions={
          <>
            <Link href={`/teacher/exams/${examId}/upload?locale=${locale}`} className="btn btn-secondary">
              <Icon.Upload size={16} />
              {t.proxyUploadTitle}
            </Link>
            <Link href={`/teacher/exams/${examId}/results?locale=${locale}`} className="btn btn-primary">
              <Icon.BarChart size={16} />
              {t.classResults}
            </Link>
          </>
        }
      />

      <Stepper
        step={step}
        labels={[t.stepUpload, t.stepAnalyse, t.stepReview]}
        nextStep={nextStepCopy}
        t={t}
      />

      {banner ? <Alert tone={isSuccessBanner ? "success" : "error"}>{banner}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Assets */}
        <section className="card card-pad space-y-4 animate-fade-up-delay">
          <SectionHeader
            icon={<Icon.FileText size={18} />}
            title={t.examAssetsTitle}
            description={t.examUploadHint}
          />
          {exam.assets.length === 0 ? (
            <EmptyState compact title={t.examAssetsEmpty} />
          ) : (
            <ul className="space-y-2">
              {exam.assets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
                >
                  <span className="icon-tile !h-8 !w-8">
                    <Icon.FileText size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
                    {a.originalName || a.id}
                  </span>
                  <span className={`badge ${a.kind === "ANSWER_KEY" ? "badge-violet" : "badge-info"}`}>
                    {a.kind === "ANSWER_KEY" ? t.assetKindKey : t.assetKindPaper}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={onUpload} className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="grid grid-cols-2 gap-2">
              {(["QUESTION_PAPER", "ANSWER_KEY"] as const).map((kind) => (
                <label
                  key={kind}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    uploadKind === kind
                      ? "border-primary-300 bg-primary-50 text-primary-800"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="kind-choice"
                    className="sr-only"
                    checked={uploadKind === kind}
                    onChange={() => setUploadKind(kind)}
                  />
                  {kind === "QUESTION_PAPER" ? t.assetKindPaper : t.assetKindKey}
                </label>
              ))}
            </div>
            <FileField
              required
              compact
              accept="image/*,application/pdf"
              title={t.dropzoneTitle}
              hint={t.dropzoneHint}
              selectedLabel={t.fileSelected}
              resetKey={fileReset}
            />
            <button type="submit" disabled={pending} className="btn btn-primary w-full sm:w-auto">
              {pending ? <Icon.Loader size={16} /> : <Icon.Upload size={16} />}
              {pending
                ? t.uploadUploading
                : uploadKind === "QUESTION_PAPER"
                  ? t.examUploadPaper
                  : t.examUploadKey}
            </button>
          </form>
        </section>

        {/* Analysis */}
        <section className="card card-pad space-y-4 animate-fade-up-delay-2">
          <SectionHeader
            icon={<Icon.Sparkles size={18} />}
            title={t.examAnalyze}
            description={jobSucceeded ? t.examAnalyzeReadyHint : t.examStructureEmpty}
            actions={latest ? <JobStatusBadge status={latest.status} t={t} pulse /> : undefined}
          />
          <button
            type="button"
            onClick={startAnalyze}
            disabled={pending || !hasPaper}
            className="btn btn-accent w-full"
          >
            {pending ? <Icon.Loader size={16} /> : <Icon.Zap size={16} />}
            {pending ? t.examAnalyzing : jobSucceeded ? t.examReanalyze : t.examAnalyze}
          </button>
          <JobProgressPanel
            jobId={jobId}
            t={t}
            onRetry={() => void retryJob()}
            successHint={t.examStructureReady}
            onSucceeded={onStructureSucceeded}
          />
          {exam.structureLlmModel ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Icon.CheckCircle size={12} />
              {t.structureModelStored}
            </p>
          ) : null}
        </section>
      </div>

      {/* Structure */}
      <section className="card overflow-hidden animate-fade-up-delay-3">
        <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <SectionHeader
            icon={<Icon.Layers size={18} />}
            title={t.examStructureTitle}
            description={
              questions.length > 0
                ? countLabel(questions.length, t.questionsCount, t.questionsCountOne)
                : undefined
            }
          />
        </div>
        {questions.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState icon={<Icon.Scan size={22} />} title={t.examStructureEmpty} compact />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {questions.map((q, i) => (
              <li key={q.questionKey} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary-50 px-1.5 text-xs font-bold text-primary-700">
                      {q.questionKey}
                    </span>
                    {t.examStructureQuestion} {q.questionKey}
                  </p>
                  <p className="text-sm tabular-nums text-[var(--muted)]">
                    {t.examStructureMaxScore}: <span className="font-semibold text-[var(--ink)]">{q.maxScore}</span>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="chip chip--hue" style={{ ["--chip-hue" as string]: 222 + (i % 5) * 28 }}>
                    {t.topicChip}: {q.topic}
                  </span>
                  <span className="chip">
                    {t.itemTypeChip}: {q.itemType}
                  </span>
                  {q.questionCategory?.trim() ? (
                    <span className="chip">
                      {t.examStructureCategory}: {q.questionCategory}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <dt className="text-xs font-semibold text-primary-700">{t.examStructureObjective}</dt>
                    <dd className="mt-0.5 text-[var(--ink)]">{q.assessmentObjective?.trim() || "—"}</dd>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                    <dt className="text-xs font-semibold text-[var(--teal-600)]">{t.examStructureDifficulty}</dt>
                    <dd className="mt-0.5 text-[var(--ink)]">{q.difficultyPoints?.trim() || "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href={`/teacher?locale=${locale}`} className="link-muted inline-flex items-center gap-1 text-sm">
        <Icon.ArrowLeft size={14} />
        {t.examBack}
      </Link>
    </div>
  );
}

function Stepper({
  step,
  labels,
  nextStep,
  t,
}: {
  step: number;
  labels: string[];
  nextStep: string;
  t: Dictionary;
}) {
  return (
    <div className="card card-pad animate-fade-up">
      <ol className="grid gap-3 sm:grid-cols-3">
        {labels.map((label, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  state === "done"
                    ? "bg-emerald-500 text-white"
                    : state === "current"
                      ? "bg-primary-600 text-white shadow-[var(--shadow-primary)]"
                      : "bg-[var(--surface-sunken)] text-[var(--muted)]"
                }`}
                aria-current={state === "current" ? "step" : undefined}
              >
                {state === "done" ? <Icon.Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-sm font-semibold ${
                  state === "todo" ? "text-[var(--muted)]" : "text-[var(--ink)]"
                }`}
              >
                {label}
              </span>
              {i < labels.length - 1 ? (
                <span className="hidden h-px flex-1 bg-[var(--border)] sm:block" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
        <Icon.Info size={16} className="shrink-0 text-primary-600" />
        <span>
          <span className="font-semibold">{t.nextStep}: </span>
          {nextStep}
        </span>
      </p>
    </div>
  );
}
