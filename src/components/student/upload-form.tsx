"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { FILE_CHECK_ERROR_CODES } from "@/lib/errors";
import { EXAM_UPLOAD_ACCEPT } from "@/lib/files/exam-upload";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { Alert } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";

export function StudentUploadForm({
  locale,
  t,
  examId,
}: {
  locale: Locale;
  t: Dictionary;
  examId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showCheckFile, setShowCheckFile] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [fileReset, setFileReset] = useState(0);
  const [pending, startTransition] = useTransition();
  const [archived, setArchived] = useState(false);
  const [structureReady, setStructureReady] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/exams/${examId}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          if (data.exam?.archived) setArchived(true);
          setStructureReady(Boolean(data.exam?.structureLlmModel));
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!structureReady) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setShowCheckFile(false);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/submissions`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.uploadError);
          setShowCheckFile(
            typeof data.code === "string" && FILE_CHECK_ERROR_CODES.has(data.code),
          );
          return;
        }
        setSuccess(t.uploadSuccess);
        setJobId(data.job?.jobId ?? null);
        setSubmissionId(data.submission?.id ?? null);
        form.reset();
        setFileReset((n) => n + 1);
      } catch {
        setError(t.uploadError);
        setShowCheckFile(false);
      }
    });
  }

  async function retry() {
    if (!submissionId) return;
    const res = await fetch(`/api/submissions/${submissionId}/analyze`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setJobId(data.jobId);
      setError(null);
      setShowCheckFile(false);
    } else {
      setError(data.error || t.examAnalyzeError);
      setShowCheckFile(false);
    }
  }

  const steps = [t.stepUpload, t.stepAnalyse, t.stepReview];
  const current = submissionId ? 1 : 0;

  if (!checked) return null;

  if (archived) {
    return (
      <div className="mt-8 space-y-4">
        <Alert tone="warn">{t.classArchivedBanner}</Alert>
        <Link href={`/student?locale=${locale}`} className="btn btn-secondary">
          <Icon.ArrowLeft size={16} />
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={onSubmit} className="card card-pad animate-fade-up-delay space-y-5">
        <ol className="flex items-center gap-2 text-xs font-semibold">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  i < current
                    ? "bg-emerald-500 text-white"
                    : i === current
                      ? "bg-[var(--role-student)] text-white"
                      : "bg-[var(--surface-sunken)] text-[var(--muted)]"
                }`}
              >
                {i < current ? <Icon.Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={i <= current ? "text-[var(--ink)]" : "text-[var(--muted)]"}>{s}</span>
              {i < steps.length - 1 ? <Icon.ChevronRight size={12} className="text-[var(--faint)]" /> : null}
            </li>
          ))}
        </ol>

        {!structureReady ? (
          <Alert tone="warn">{t.uploadStructureNotReady}</Alert>
        ) : null}

        <FileField
          required
          multiple
          accept={EXAM_UPLOAD_ACCEPT}
          title={t.dropzoneTitle}
          hint={t.uploadMultipleHint}
          selectedLabel={t.fileSelected}
          resetKey={fileReset}
        />

        {error ? (
          <Alert
            tone="error"
            action={
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setError(null)}>
                {t.uploadRetry}
              </button>
            }
          >
            <p>{error}</p>
            {showCheckFile ? (
              <p className="mt-0.5 text-xs opacity-80">{t.checkFile}</p>
            ) : null}
          </Alert>
        ) : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
          <button
            type="submit"
            disabled={pending || !structureReady}
            className="btn btn-primary"
          >
            {pending ? <Icon.Loader size={16} /> : <Icon.Upload size={16} />}
            {pending ? t.uploadUploading : t.uploadSubmit}
          </button>
          {submissionId ? (
            <Link href={`/student/submissions/${submissionId}?locale=${locale}`} className="btn btn-accent">
              <Icon.BarChart size={16} />
              {t.viewResults}
            </Link>
          ) : null}
          <Link href={`/student?locale=${locale}`} className="btn btn-ghost">
            <Icon.ArrowLeft size={16} />
            {t.navDashboard}
          </Link>
        </div>
      </form>

      <aside className="space-y-4 animate-fade-up-delay-2">
        <JobProgressPanel
          jobId={jobId}
          t={t}
          onRetry={() => void retry()}
          successHint={t.stateSuccess}
        />
        <div className="rounded-2xl border border-teal-100 bg-[var(--role-student-soft)] p-5 text-sm text-teal-900">
          <p className="flex items-center gap-2 font-semibold">
            <Icon.Info size={16} className="text-[var(--role-student)]" />
            {t.examUploadHint}
          </p>
          <p className="mt-1.5 leading-relaxed opacity-90">{t.uploadScriptIntro}</p>
        </div>
      </aside>
    </div>
  );
}
