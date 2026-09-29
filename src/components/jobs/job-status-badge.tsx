"use client";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import { jobStatusDictKey } from "@/lib/jobs/status-copy";

const tone: Record<string, string> = {
  jobStatusPending: "badge-info",
  jobStatusRunning: "badge-warn",
  jobStatusSucceeded: "badge-success",
  jobStatusFailed: "badge-error",
};

export function JobStatusBadge({
  status,
  t,
  pulse = false,
  label,
}: {
  status: string;
  t: Dictionary;
  pulse?: boolean;
  label?: string;
}) {
  const key = jobStatusDictKey(status);
  const live = !label && (key === "jobStatusRunning" || key === "jobStatusPending");
  return (
    <span className={`badge badge-dot ${label ? "badge-warn" : tone[key]} ${pulse && live ? "job-pulse" : ""}`}>
      {label || t[key]}
    </span>
  );
}
