"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { countLabel, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";
import { examAssetTitle, scriptAssetTitle, uploadExtension } from "@/lib/files/display-name";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { PdfPreview } from "@/components/teacher/pdf-preview";
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
    createdAt: string;
    studentName: string | null;
  }>;
  latestStructureJobs: Array<{
    id: string;
    status: string;
    errorMessage: string | null;
  }>;
};

function studentAnswerGroups(exam: ExamDetail) {
  const groups = new Map<string, ExamDetail["assets"]>();
  for (const asset of exam.assets) {
    if (asset.kind !== "STUDENT_SCRIPT") continue;
    const name = asset.studentName?.trim() || asset.id;
    const list = groups.get(name) ?? [];
    list.push(asset);
    groups.set(name, list);
  }
  return [...groups.entries()]
    .map(([name, pages]) => ({
      name,
      pages: pages.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function kindLabel(kind: string, t: Dictionary): string {
  if (kind === "ANSWER_KEY") return t.fileNameKey;
  if (kind === "STUDENT_SCRIPT") return t.fileNameScript;
  if (kind === "QUESTION_PAPER") return t.fileNamePaper;
  return t.fileNameOther;
}

function assetTitle(
  exam: ExamDetail,
  asset: ExamDetail["assets"][number],
  t: Dictionary,
): string {
  const sameKind = exam.assets
    .filter((item) =>
      asset.kind === "STUDENT_SCRIPT"
        ? item.kind === "STUDENT_SCRIPT" && item.studentName === asset.studentName
        : item.kind === asset.kind,
    )
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const index = Math.max(1, sameKind.findIndex((item) => item.id === asset.id) + 1);
  const extension = uploadExtension(asset.originalName, asset.mimeType);
  if (asset.kind === "STUDENT_SCRIPT") {
    return scriptAssetTitle({
      examDate: exam.examDate,
      className: exam.classSubject.name,
      examTitle: exam.title,
      studentName: asset.studentName?.trim() || t.fileNameScript,
      index,
      extension,
    });
  }
  return examAssetTitle({
    examDate: exam.examDate,
    subjectCode: exam.classSubject.subjectCode,
    className: exam.classSubject.name,
    examTitle: exam.title,
    kindLabel: kindLabel(asset.kind, t),
    index,
    extension,
  });
}

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
  const [selectedStudent, setSelectedStudent] = useState("");
  const [preview, setPreview] = useState<{
    id: string;
    title: string;
    mimeType: string | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

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
          {
            label: exam.classSubject.subjectCode,
            href: `/teacher?locale=${locale}`,
          },
          { label: exam.title },
        ]}
        eyebrow={
          <Link href={`/teacher?locale=${locale}`} className="hover:underline">
            {exam.classSubject.name} · {exam.classSubject.subjectCode}
          </Link>
        }
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
          {exam.assets.filter((a) => a.kind !== "STUDENT_SCRIPT").length === 0 ? (
            <EmptyState compact title={t.examAssetsEmpty} />
          ) : (
            <ul className="space-y-2">
              {exam.assets
                .filter((a) => a.kind !== "STUDENT_SCRIPT")
                .map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
                >
                  <span className="icon-tile !h-8 !w-8">
                    <Icon.FileText size={14} />
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium text-[var(--ink)] hover:text-primary-700"
                    onClick={() =>
                      setPreview({
                        id: a.id,
                        title: assetTitle(exam, a, t),
                        mimeType: a.mimeType,
                      })
                    }
                  >
                    {assetTitle(exam, a, t)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setPreview({
                        id: a.id,
                        title: assetTitle(exam, a, t),
                        mimeType: a.mimeType,
                      })
                    }
                  >
                    <Icon.Eye size={14} />
                    {t.previewFile}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setPendingDelete({ id: a.id, title: assetTitle(exam, a, t) })
                    }
                  >
                    <Icon.X size={14} />
                    {t.deleteAsset}
                  </button>
                  <span className={`badge ${a.kind === "ANSWER_KEY" ? "badge-violet" : "badge-info"}`}>
                    {a.kind === "ANSWER_KEY" ? t.assetKindKey : t.assetKindPaper}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--ink)]">{t.studentAnswersTitle}</h3>
            {studentAnswerGroups(exam).length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t.studentAnswersEmpty}</p>
            ) : (
              <>
                <label className="label" htmlFor="student-answer-select">
                  {t.studentAnswersSelect}
                </label>
                <select
                  id="student-answer-select"
                  className="select"
                  value={
                    studentAnswerGroups(exam).some((group) => group.name === selectedStudent)
                      ? selectedStudent
                      : ""
                  }
                  onChange={(event) => setSelectedStudent(event.target.value)}
                >
                  <option value="">{t.studentAnswersSelect}</option>
                  {studentAnswerGroups(exam).map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
                {studentAnswerGroups(exam)
                  .filter((group) => group.name === selectedStudent)
                  .map((group) => (
                    <ul key={group.name} className="flex gap-2 overflow-x-auto pb-1">
                      {group.pages.map((a) => (
                        <li
                          key={a.id}
                          className="flex w-56 shrink-0 flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
                        >
                          <button
                            type="button"
                            className="truncate text-left font-medium text-[var(--ink)] hover:text-primary-700"
                            onClick={() =>
                              setPreview({
                                id: a.id,
                                title: assetTitle(exam, a, t),
                                mimeType: a.mimeType,
                              })
                            }
                          >
                            {assetTitle(exam, a, t)}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm self-start"
                            onClick={() =>
                              setPreview({
                                id: a.id,
                                title: assetTitle(exam, a, t),
                                mimeType: a.mimeType,
                              })
                            }
                          >
                            <Icon.Eye size={14} />
                            {t.previewFile}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ))}
              </>
            )}
          </div>

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

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-asset-title"
        >
          <div className="card w-full max-w-md p-6">
            <h2 id="delete-asset-title" className="text-lg font-semibold text-[var(--ink)]">
              {t.deleteAssetConfirm}
            </h2>
            <p className="mt-2 break-all text-sm text-[var(--muted)]">{pendingDelete.title}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingDelete(null)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => {
                  const target = pendingDelete;
                  startTransition(async () => {
                    try {
                      const res = await fetch(
                        `/api/exams/${examId}/assets/${target.id}`,
                        { method: "DELETE" },
                      );
                      const data = await res.json();
                      if (!res.ok) {
                        setBanner(data.error || t.stateError);
                        setPendingDelete(null);
                        return;
                      }
                      setPreview((current) => (current?.id === target.id ? null : current));
                      setPendingDelete(null);
                      setBanner(null);
                      await load();
                    } catch {
                      setBanner(t.stateError);
                      setPendingDelete(null);
                    }
                  });
                }}
              >
                {pending ? <Icon.Loader size={16} /> : <Icon.X size={16} />}
                {t.deleteAsset}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {preview ? (
        <FilePreview
          title={preview.title}
          src={`/api/exams/${examId}/assets/${preview.id}`}
          mimeType={preview.mimeType}
          closeLabel={t.closePreview}
          loadingLabel={t.previewLoading}
          errorLabel={t.previewError}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function FilePreview({
  title,
  src,
  mimeType,
  closeLabel,
  loadingLabel,
  errorLabel,
  onClose,
}: {
  title: string;
  src: string;
  mimeType: string | null;
  closeLabel: string;
  loadingLabel: string;
  errorLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const image = mimeType?.startsWith("image/") ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex h-[min(86vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)]">{title}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon.X size={16} />
            {closeLabel}
          </button>
        </header>
        <div className="min-h-0 flex-1 bg-[var(--surface-muted)]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={title} className="h-full w-full object-contain" />
          ) : (
            <PdfPreview src={src} loadingLabel={loadingLabel} errorLabel={errorLabel} />
          )}
        </div>
      </div>
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
