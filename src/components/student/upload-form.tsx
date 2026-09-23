"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";

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
  const [success, setSuccess] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
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
          return;
        }
        setSuccess(t.uploadSuccess);
        setJobId(data.job?.jobId ?? null);
        setSubmissionId(data.submission?.id ?? null);
        form.reset();
      } catch {
        setError(t.uploadError);
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
    } else {
      setError(data.error || t.examAnalyzeError);
    }
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 student-upload-panel"
      >
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">{t.uploadChooseFile}</span>
          <input
            name="file"
            type="file"
            required
            accept="image/*,application/pdf"
            className="block"
          />
        </label>
        <p className="text-xs text-[var(--muted)]">{t.uploadScriptIntro}</p>
        {error ? (
          <div className="text-sm text-[var(--color-error)]">
            <p>{error}</p>
            <p className="mt-1">{t.checkFile}</p>
            <button
              type="button"
              className="mt-2 underline"
              onClick={() => setError(null)}
            >
              {t.uploadRetry}
            </button>
          </div>
        ) : null}
        {success ? (
          <p className="text-sm text-[var(--color-success)] animate-success-pop">
            {success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? t.uploadUploading : t.uploadSubmit}
        </button>
      </form>

      <JobProgressPanel
        jobId={jobId}
        t={t}
        onRetry={() => void retry()}
        successHint={t.stateSuccess}
      />

      {submissionId ? (
        <Link
          href={`/student/submissions/${submissionId}?locale=${locale}`}
          className="inline-block text-sm font-medium text-[var(--brand)] hover:underline"
        >
          {t.viewResults}
        </Link>
      ) : null}

      <Link
        href={`/student?locale=${locale}`}
        className="inline-block text-sm text-[var(--muted)] hover:underline"
      >
        {t.backHome}
      </Link>
    </div>
  );
}
