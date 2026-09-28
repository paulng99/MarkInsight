"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { countLabel, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";
import {
  groupStructureQuestions,
  type FlatStructureQuestion,
  type StructureQuestionGroup,
} from "@/lib/exams/structure-questions";
import { examAssetTitle, scriptAssetTitle, uploadExtension } from "@/lib/files/display-name";
import { JobProgressPanel, type JobSnapshot } from "@/components/jobs/job-progress-panel";
import { PdfPreview } from "@/components/teacher/pdf-preview";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import type { AnalysisProgress } from "@/lib/jobs/progress-types";
import { emptyAnalysisProgress } from "@/lib/jobs/progress-types";
import {
  describeAnalysisActivity,
  formatElapsed,
  normalizeJobStatus,
} from "@/lib/jobs/status-copy";

type ExamDetail = {
  id: string;
  title: string;
  examDate: string;
  classSubject: { id: string; name: string; subjectCode: string };
  structureLlmModel: string | null;
  structureQuestions: FlatStructureQuestion[];
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
    startedAt?: string | null;
  }>;
  archived?: boolean;
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
  const [liveJob, setLiveJob] = useState<JobSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const pinJob = useRef(false);
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
      setJobId((current) => {
        if (pinJob.current) return current;
        return data.exam.latestStructureJobs?.[0]?.id ?? current;
      });
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

  useEffect(() => {
    const status = liveJob?.status;
    const active = status === "PENDING" || status === "RUNNING" || status === "ANALYZING";
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [liveJob?.status]);

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

  const onJobSnapshot = useCallback((job: JobSnapshot) => {
    setLiveJob(job);
    if (job.status === "SUCCEEDED" && job.progress && job.progress.questions.length > 0) {
      setExam((current) =>
        current ? { ...current, structureQuestions: job.progress?.questions ?? [] } : current,
      );
    }
  }, []);

  function startAnalyze() {
    setBanner(null);
    setStartingAnalysis(true);
    pinJob.current = true;
    const startedAt = new Date().toISOString();
    setJobId(null);
    setLiveJob({
      id: "pending",
      status: "PENDING",
      startedAt,
      progress: emptyAnalysisProgress(startedAt),
    });
    void (async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/analyze`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner(data.error || t.examAnalyzeError);
          setLiveJob(null);
          pinJob.current = false;
          await load();
          return;
        }
        setJobId(data.jobId);
        setBanner(null);
        pinJob.current = false;
        await load();
      } catch {
        setBanner(t.examAnalyzeError);
        setLiveJob(null);
        pinJob.current = false;
        await load();
      } finally {
        pinJob.current = false;
        setStartingAnalysis(false);
      }
    })();
  }

  async function retryJob() {
    if (!jobId) return;
    const previous = jobId;
    pinJob.current = true;
    const startedAt = new Date().toISOString();
    setJobId(null);
    setLiveJob({
      id: "pending",
      status: "PENDING",
      startedAt,
      progress: emptyAnalysisProgress(startedAt),
    });
    const res = await fetch(`/api/jobs/${previous}`, { method: "POST" });
    const data = await res.json();
    pinJob.current = false;
    if (res.ok) {
      setJobId(data.jobId);
      setBanner(null);
    } else {
      setBanner(data.error || t.examAnalyzeError);
      setLiveJob(null);
      await load();
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

  const savedQuestions = exam.structureQuestions ?? [];
  const latest = exam.latestStructureJobs[0];
  const displayStatus = liveJob?.status ?? (startingAnalysis ? "PENDING" : latest?.status ?? "");
  const jobPhase = displayStatus ? normalizeJobStatus(displayStatus) : null;
  const jobActive = jobPhase === "PENDING" || jobPhase === "ANALYZING";
  const jobSucceeded = jobPhase === "SUCCEEDED";
  const jobFailed = jobPhase === "FAILED";
  const progress: AnalysisProgress | null = liveJob?.progress ?? null;
  const touchedAt = progress?.updatedAt ?? liveJob?.startedAt ?? latest?.startedAt ?? null;
  const idleMs = touchedAt ? now - new Date(touchedAt).getTime() : 0;
  const stalled = jobActive && !startingAnalysis && idleMs > 3 * 60 * 1000;
  const running = startingAnalysis || (jobActive && !stalled);
  const questions = running && progress ? progress.questions : savedQuestions;
  const groups = groupStructureQuestions(questions);
  const activity = describeAnalysisActivity(
    {
      status: displayStatus || "PENDING",
      stage: progress?.stage ?? null,
      completed: progress?.completed ?? 0,
      total: progress?.total ?? 0,
      questionKey: progress?.questionKey ?? null,
      partKeys: progress?.partKeys ?? [],
    },
    {
      queued: t.analysisQueued,
      reading: t.analysisReading,
      live: t.analysisLive,
      done: t.analysisDone,
      liveNoKey: t.analysisLiveNoKey,
      saving: t.analysisSaving,
      succeeded: t.examStructureReady,
      failed: t.jobStatusFailed,
      open: locale === "zh-HK" ? "（" : " (",
      close: locale === "zh-HK" ? "）" : ")",
      sep: locale === "zh-HK" ? "、" : ", ",
    },
  );
  const elapsed = formatElapsed(liveJob?.startedAt ?? progress?.startedAt, now);
  const headline = stalled
    ? t.analysisStalled
    : running && elapsed
      ? `${activity.headline} · ${elapsed}`
      : activity.headline;
  const hasPaper = exam.assets.length > 0;
  const isSuccessBanner = banner === t.uploadSuccess || banner === t.examStructureReady;

  const step = !hasPaper ? 0 : !jobSucceeded ? 1 : 2;
  const nextStepCopy =
    running || stalled
      ? headline
      : jobFailed
        ? liveJob?.errorMessage || latest?.errorMessage || t.stateError
        : [t.nextStepUploadPaper, t.nextStepAnalyse, t.nextStepDistribute][step];
  const archived = exam.archived === true;

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
            {archived ? null : (
              <Link href={`/teacher/exams/${examId}/upload?locale=${locale}`} className="btn btn-secondary">
                <Icon.Upload size={16} />
                {t.proxyUploadTitle}
              </Link>
            )}
            <Link href={`/teacher/exams/${examId}/results?locale=${locale}`} className="btn btn-primary">
              <Icon.BarChart size={16} />
              {t.classResults}
            </Link>
          </>
        }
      />

      {archived ? <Alert tone="warn">{t.classArchivedBanner}</Alert> : null}

      <Stepper
        step={step}
        labels={[
          t.stepUpload,
          running && activity.fraction ? `${t.stepAnalyse} ${activity.fraction}` : t.stepAnalyse,
          t.stepReview,
        ]}
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
                  {archived ? null : (
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
                  )}
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

          {archived ? null : (
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
          )}
        </section>

        {/* Analysis */}
        <section className="card card-pad space-y-4 animate-fade-up-delay-2">
          <SectionHeader
            icon={<Icon.Sparkles size={18} />}
            title={t.examAnalyze}
            description={
              running || stalled
                ? undefined
                : jobSucceeded
                  ? t.examAnalyzeReadyHint
                  : groups.length > 0
                    ? undefined
                    : t.examStructureEmpty
            }
          />
          {archived ? null : (
            <button
              type="button"
              onClick={startAnalyze}
              disabled={running || !hasPaper}
              className="btn btn-accent w-full"
            >
              {running ? <Icon.Loader size={16} /> : <Icon.Zap size={16} />}
              {running ? headline : jobSucceeded || stalled ? t.examReanalyze : t.examAnalyze}
            </button>
          )}
          <JobProgressPanel
            jobId={jobId}
            t={t}
            onRetry={archived ? undefined : () => void retryJob()}
            successHint={t.examStructureReady}
            onSucceeded={onStructureSucceeded}
            onSnapshot={onJobSnapshot}
            placeholder={!jobId && running ? liveJob : null}
            headline={running || stalled ? headline : undefined}
            percent={running || jobSucceeded ? activity.percent : undefined}
            indeterminate={running && activity.indeterminate}
            badgeText={stalled ? t.analysisStalledBadge : undefined}
            showThinking={!stalled}
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
              running
                ? (activity.fraction ?? headline)
                : groups.length > 0
                  ? countLabel(groups.length, t.questionsCount, t.questionsCountOne)
                  : undefined
            }
          />
        </div>
        {groups.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={<Icon.Scan size={22} />}
              title={running ? t.examStructureLiveEmpty : t.examStructureEmpty}
              compact
            />
          </div>
        ) : (
          <QuestionStructureList
            groups={groups}
            activeKey={running ? progress?.questionKey ?? null : null}
            t={t}
          />
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

function QuestionStructureList({
  groups,
  activeKey,
  t,
}: {
  groups: StructureQuestionGroup[];
  activeKey: string | null;
  t: Dictionary;
}) {
  useEffect(() => {
    if (!activeKey) return;
    document.getElementById(`structure-q-${activeKey}`)?.scrollIntoView({ block: "nearest" });
  }, [activeKey]);

  return (
    <ul className="divide-y divide-[var(--border)]">
      {groups.map((group, index) => {
        const active =
          activeKey === group.questionKey ||
          group.parts.some((part) => part.questionKey === activeKey);
        const single = group.parts.length <= 1 && !group.parts[0]?.partKey;
        const lead = single ? group.parts[0]?.prompt || group.stem : group.stem;
        return (
          <li
            key={group.questionKey}
            id={`structure-q-${group.questionKey}`}
            className={`px-5 py-4 sm:px-6 ${active ? "bg-primary-50/80" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary-50 px-1.5 text-xs font-bold text-primary-700">
                  {group.questionKey}
                </span>
                {t.examStructureQuestion} {group.questionKey}
              </p>
              <p className="text-sm tabular-nums text-[var(--muted)]">
                {t.examStructureMaxScore}:{" "}
                <span className="font-semibold text-[var(--ink)]">{group.maxScore}</span>
              </p>
            </div>
            {lead ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">{lead}</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">{t.examStructurePromptMissing}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip chip--hue" style={{ ["--chip-hue" as string]: 222 + (index % 5) * 28 }}>
                {t.topicChip}: {group.topic}
              </span>
              <span className="chip">
                {t.itemTypeChip}: {group.itemType}
              </span>
              {group.questionCategory.trim() ? (
                <span className="chip">
                  {t.examStructureCategory}: {group.questionCategory}
                </span>
              ) : null}
            </div>
            {single ? (
              <QuestionMeta
                objective={group.parts[0]?.assessmentObjective || group.assessmentObjective}
                difficulty={group.parts[0]?.difficultyPoints || group.difficultyPoints}
                t={t}
              />
            ) : (
              <ul className="mt-3 space-y-3">
                {group.parts.map((part) => (
                  <li key={part.questionKey} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-sm font-semibold text-primary-800">
                      {t.examStructurePart} ({part.partKey})
                      <span className="ml-2 font-medium text-[var(--muted)]">
                        {t.examStructureMaxScore} {part.maxScore}
                      </span>
                    </p>
                    {part.prompt && part.prompt !== group.stem ? (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
                        {part.prompt}
                      </p>
                    ) : null}
                    <QuestionMeta
                      objective={part.assessmentObjective}
                      difficulty={part.difficultyPoints}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function QuestionMeta({
  objective,
  difficulty,
  t,
}: {
  objective: string;
  difficulty: string;
  t: Dictionary;
}) {
  return (
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
        <dt className="text-xs font-semibold text-primary-700">{t.examStructureObjective}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap text-[var(--ink)]">{objective.trim() || "—"}</dd>
      </div>
      <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
        <dt className="text-xs font-semibold text-[var(--teal-600)]">{t.examStructureDifficulty}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap text-[var(--ink)]">{difficulty.trim() || "—"}</dd>
      </div>
    </dl>
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
