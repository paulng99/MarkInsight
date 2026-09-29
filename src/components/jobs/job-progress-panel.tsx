"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AnalysisProgress } from "@/lib/jobs/progress-types";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Icon } from "@/components/ui/icons";
import { normalizeJobStatus } from "@/lib/jobs/status-copy";

export type JobSnapshot = {
  id: string;
  status: string;
  errorMessage?: string | null;
  startedAt?: string | null;
  progress?: AnalysisProgress | null;
};

export function useJobPoll(jobId: string | null, intervalMs = 1000) {
  const [job, setJob] = useState<JobSnapshot | null>(null);
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
    <ol className="mt-3 grid grid-cols-3 gap-2">
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && n === "SUCCEEDED");
        const current = i === idx && n !== "SUCCEEDED";
        return (
          <li key={s}>
            <span
              className={`block h-1.5 rounded-full transition-colors ${
                failed && current
                  ? "bg-rose-500"
                  : done
                    ? "bg-emerald-500"
                    : current
                      ? "bg-primary-500 job-pulse"
                      : "bg-[var(--surface-sunken)]"
              }`}
            />
            <span
              className={`mt-1 block text-xs font-semibold ${
                current || done ? "text-[var(--ink)]" : "text-[var(--muted)]"
              }`}
            >
              {labels[i]}
            </span>
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
  onSnapshot,
  placeholder,
  headline,
  percent,
  indeterminate,
  badgeText,
  showThinking = true,
}: {
  jobId: string | null;
  t: Dictionary;
  onRetry?: () => void;
  successHint?: string;
  /** Fired once when the polled job reaches SUCCEEDED. */
  onSucceeded?: () => void;
  onSnapshot?: (job: JobSnapshot) => void;
  /** Shown while a new job id has not arrived yet. */
  placeholder?: JobSnapshot | null;
  /** Shared status sentence. When set, this panel uses the same words as the rest of the page. */
  headline?: string;
  percent?: number;
  indeterminate?: boolean;
  badgeText?: string;
  /** When false, hide the live “checking” line. */
  showThinking?: boolean;
}) {
  const { job, error, refresh } = useJobPoll(jobId);
  const [notifiedSuccess, setNotifiedSuccess] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    setNotifiedSuccess(false);
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !job) return;
    onSnapshotRef.current?.(job);
  }, [job, jobId]);

  useEffect(() => {
    if (!job || job.status !== "SUCCEEDED" || notifiedSuccess) return;
    setNotifiedSuccess(true);
    onSucceeded?.();
  }, [job, notifiedSuccess, onSucceeded]);

  const view = jobId ? job : placeholder;

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [view?.progress?.log.length, view?.progress?.note]);

  if (!jobId && !placeholder) {
    return (
      <div className="card-muted flex items-center gap-3 px-4 py-4 text-sm text-[var(--muted)]">
        <span className="icon-tile !h-9 !w-9 !bg-[var(--surface-sunken)] !text-[var(--muted)]">
          <Icon.Clock size={16} />
        </span>
        {t.stateEmpty}
      </div>
    );
  }

  if (error && !view) {
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

  if (!view) {
    return (
      <div className="card flex items-center gap-3 px-4 py-4 text-sm text-[var(--muted)]">
        <Icon.Loader size={16} />
        {headline || t.analysisReading}
      </div>
    );
  }

  const n = normalizeJobStatus(view.status);
  const progress = view.progress ?? null;
  const showLive = Boolean(headline || progress);
  const bar = typeof percent === "number" ? percent : n === "SUCCEEDED" ? 100 : n === "PENDING" ? 8 : 18;
  const pulsing = indeterminate ?? (showLive && (progress?.total ?? 0) <= 0 && n !== "SUCCEEDED" && n !== "FAILED");
  const thinking = progress?.note?.trim() || (n === "ANALYZING" || n === "PENDING" ? t.analysisReadingDetail : "");

  return (
    <div className="card px-4 py-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          {n === "SUCCEEDED" ? (
            <Icon.CheckCircle size={16} className="text-emerald-600" />
          ) : n === "FAILED" ? (
            <Icon.AlertCircle size={16} className="text-rose-600" />
          ) : (
            <Icon.Loader size={16} className="text-primary-600" />
          )}
          {headline || t.latestJob}
        </p>
        <JobStatusBadge status={view.status} t={t} pulse={!badgeText} label={badgeText} />
      </div>
      {showLive ? (
        <div
          className="progress mt-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pulsing ? undefined : bar}
        >
          <span className={pulsing ? "is-indeterminate" : undefined} style={pulsing ? undefined : { width: `${bar}%` }} />
        </div>
      ) : (
        <StepTrack status={view.status} t={t} />
      )}
      {showLive && showThinking && thinking && n !== "SUCCEEDED" && n !== "FAILED" ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
          <span className="font-semibold text-primary-700">{t.analysisThinking}: </span>
          {thinking}
        </p>
      ) : null}
      {showLive && progress && progress.log.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--muted)]">{t.analysisLog}</p>
          <ol ref={logRef} className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {progress.log.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                <span className="font-semibold text-[var(--ink)]">
                  {entry.questionKey
                    ? `${t.examStructureQuestion} ${entry.questionKey}${
                        entry.partKeys.length ? ` (${entry.partKeys.join(", ")})` : ""
                      }`
                    : t.analysisReading}
                </span>
                {entry.total > 0 ? (
                  <span className="tabular-nums text-[var(--muted)]">
                    {" "}
                    {entry.completed}/{entry.total}
                  </span>
                ) : null}
                {entry.note ? <span className="text-[var(--muted)]"> — {entry.note}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {n === "FAILED" ? (
        <div className="mt-3 rounded-lg bg-[var(--color-error-soft)] px-3 py-2.5 text-sm text-[#9f1239]">
          <p>{view.errorMessage || t.stateError}</p>
          {view.errorMessage?.includes("請檢查檔案") ||
          view.errorMessage?.toLowerCase().includes("check the file") ? (
            <p className="mt-1 text-xs opacity-80">{t.checkFile}</p>
          ) : null}
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
      {!showLive && (n === "PENDING" || n === "ANALYZING") ? (
        <p className="mt-3 text-xs text-[var(--muted)]">{t.jobStatusRunning}</p>
      ) : null}
    </div>
  );
}
