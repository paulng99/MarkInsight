"use client";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import { jobStatusDictKey } from "@/lib/jobs/status-copy";

const tone: Record<string, string> = {
  jobStatusPending: "bg-[color-mix(in_srgb,var(--color-info)_18%,white)] text-[var(--color-info)]",
  jobStatusRunning: "bg-[color-mix(in_srgb,var(--color-warn)_18%,white)] text-[var(--color-warn)]",
  jobStatusSucceeded:
    "bg-[color-mix(in_srgb,var(--color-success)_18%,white)] text-[var(--color-success)]",
  jobStatusFailed:
    "bg-[color-mix(in_srgb,var(--color-error)_18%,white)] text-[var(--color-error)]",
};

export function JobStatusBadge({
  status,
  t,
  pulse = false,
}: {
  status: string;
  t: Dictionary;
  pulse?: boolean;
}) {
  const key = jobStatusDictKey(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide ${tone[key]} ${
        pulse && (key === "jobStatusRunning" || key === "jobStatusPending")
          ? "job-pulse"
          : ""
      }`}
    >
      {t[key]}
    </span>
  );
}
