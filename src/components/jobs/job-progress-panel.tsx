"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Icon } from "@/components/ui/icons";
import { normalizeJobStatus } from "@/lib/jobs/status-copy";

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

  const terminal =
    job?.status === "SUCCEEDED" || job?.status === "FAILED" || job?.status === "DONE";

  useEffect(() => {
    if (!jobId) return;
    void refresh();
    if (terminal) return;
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [jobId, intervalMs, refresh, terminal]);

  return { job, error, refresh };
}

const steps = ["PENDING", "ANALYZING", "SUCCEEDED"] as const;

function StepTrack({ status, t }: { status: string; t: Dictionary }) {
  const n = normalizeJobStatus(status);
  const failed = n === "FAILED";
  const idx = failed ? 1 : steps.indexOf(n as (typeof steps)[number]);
  const labels = [t.jobStatusPending, t.jobStatusRunning, t.jobStatusSucceeded];
  return (
    <ol className="mt-3 flex items-center gap-2" aria-hidden>
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && n === "SUCCEEDED");
        const current = i === idx && n !== "SUCCEEDED";
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                failed && current
                  ? "bg-rose-500"
                  : done
                    ? "bg-emerald-500"
                    : current
                      ? "bg-primary-500 job-pulse"
                      : "bg-[var(--surface-sunken)]"
              }`}
            />
            <span className="sr-only">{labels[i]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function JobProgressPanel({
  jobId,
  t,
  onRetry,
  successHint,
  onSucceeded,
}: {
  jobId: string | null;
  t: Dictionary;
  onRetry?: () => void;
  successHint?: string;
  /** Fired once when the polled job reaches SUCCEEDED. */
  onSucceeded?: () => void;
}) {
  const { job, error, refresh } = useJobPoll(jobId);
  const [notifiedSuccess, setNotifiedSuccess] = useState(false);

  useEffect(() => {
    setNotifiedSuccess(false);
  }, [jobId]);

  useEffect(() => {
    if (!job || job.status !== "SUCCEEDED" || notifiedSuccess) return;
    setNotifiedSuccess(true);
    onSucceeded?.();
  }, [job, notifiedSuccess, onSucceeded]);

  if (!jobId) {
    return (
      <div className="card-muted flex items-center gap-3 px-4 py-4 text-sm text-[var(--muted)]">
        <span className="icon-tile !h-9 !w-9 !bg-[var(--surface-sunken)] !text-[var(--muted)]">
          <Icon.Clock size={16} />
        </span>
        {t.stateEmpty}
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="alert alert-error">
        <Icon.AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <p>{t.stateError}</p>
          <button type="button" onClick={() => void refresh()} className="btn btn-danger btn-sm mt-2">
            <Icon.Refresh size={14} />
            {t.settingsRetry}
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card flex items-center gap-3 px-4 py-4 text-sm text-[var(--muted)]">
        <Icon.Loader size={16} />
        {t.stateLoading}
      </div>
    );
  }

  const n = normalizeJobStatus(job.status);

  return (
    <div className="card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          {n === "SUCCEEDED" ? (
            <Icon.CheckCircle size={16} className="text-emerald-600" />
          ) : n === "FAILED" ? (
            <Icon.AlertCircle size={16} className="text-rose-600" />
          ) : (
            <Icon.Loader size={16} className="text-primary-600" />
          )}
          {t.latestJob}
        </p>
        <JobStatusBadge status={job.status} t={t} pulse />
      </div>
      <StepTrack status={job.status} t={t} />
      {n === "FAILED" ? (
        <div className="mt-3 rounded-lg bg-[var(--color-error-soft)] px-3 py-2.5 text-sm text-[#9f1239]">
          <p>{job.errorMessage || t.stateError}</p>
          <p className="mt-1 text-xs opacity-80">{t.checkFile}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="btn btn-primary btn-sm mt-3">
              <Icon.Refresh size={14} />
              {t.analyzeRetry}
            </button>
          ) : null}
        </div>
      ) : null}
      {n === "SUCCEEDED" && successHint ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700 animate-success-pop">
          <Icon.Sparkles size={14} />
          {successHint}
        </p>
      ) : null}
      {n === "PENDING" || n === "ANALYZING" ? (
        <p className="mt-3 text-xs text-[var(--muted)]">{t.stateLoading}</p>
      ) : null}
    </div>
  );
}
