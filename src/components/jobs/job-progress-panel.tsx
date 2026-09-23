"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type JobPayload = {
  id: string;
  status: string;
  errorMessage?: string | null;
  llmModel?: string | null;
};

export function useJobPoll(jobId: string | null, intervalMs = 1500) {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error");
        return;
      }
      setJob(data.job);
      setError(null);
    } catch {
      setError("error");
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [jobId, intervalMs, refresh]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "SUCCEEDED" || job.status === "FAILED") {
      // stop polling via status — interval still runs but cheap
    }
  }, [job]);

  return { job, error, refresh };
}

export function JobProgressPanel({
  jobId,
  t,
  onRetry,
  successHint,
}: {
  jobId: string | null;
  t: Dictionary;
  onRetry?: () => void;
  successHint?: string;
}) {
  const { job, error, refresh } = useJobPoll(jobId);

  if (!jobId) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
        {t.stateEmpty}
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="rounded-xl border border-[var(--color-error)]/30 bg-[color-mix(in_srgb,var(--color-error)_8%,white)] px-4 py-4 text-sm text-[var(--color-error)]">
        <p>{t.stateError}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-2 font-medium underline"
        >
          {t.settingsRetry}
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
        {t.stateLoading}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--ink)]">{t.latestJob}</p>
        <JobStatusBadge status={job.status} t={t} pulse />
      </div>
      {job.status === "FAILED" ? (
        <div className="mt-3 text-sm text-[var(--color-error)]">
          <p>{job.errorMessage || t.stateError}</p>
          <p className="mt-1 text-[var(--muted)]">{t.checkFile}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              {t.analyzeRetry}
            </button>
          ) : null}
        </div>
      ) : null}
      {job.status === "SUCCEEDED" && successHint ? (
        <p className="mt-3 text-sm text-[var(--color-success)] animate-success-pop">
          {successHint}
        </p>
      ) : null}
      {job.status === "PENDING" || job.status === "RUNNING" ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{t.stateLoading}</p>
      ) : null}
    </div>
  );
}
