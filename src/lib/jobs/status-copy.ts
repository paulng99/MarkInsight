/**
 * Map AnalysisJob / Submission statuses to product UI copy keys.
 * PENDING→排隊中, RUNNING→進行中, SUCCEEDED→成功, FAILED→失敗
 * Submission ANALYZING / QUEUED also supported.
 */

export type JobUiStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "ANALYZING";

export function normalizeJobStatus(status: string): JobUiStatus {
  switch (status) {
    case "PENDING":
    case "QUEUED":
      return "PENDING";
    case "RUNNING":
    case "ANALYZING":
      return "ANALYZING";
    case "SUCCEEDED":
    case "DONE":
      return "SUCCEEDED";
    case "FAILED":
      return "FAILED";
    default:
      return "PENDING";
  }
}

/** Dictionary keys for job status badges. */
export type JobStatusDictKey =
  | "jobStatusPending"
  | "jobStatusRunning"
  | "jobStatusSucceeded"
  | "jobStatusFailed";

export function jobStatusDictKey(status: string): JobStatusDictKey {
  const n = normalizeJobStatus(status);
  switch (n) {
    case "PENDING":
      return "jobStatusPending";
    case "RUNNING":
    case "ANALYZING":
      return "jobStatusRunning";
    case "SUCCEEDED":
      return "jobStatusSucceeded";
    case "FAILED":
      return "jobStatusFailed";
  }
}

export type AnalysisActivityInput = {
  status: string;
  stage: "reading" | "receiving" | "question" | "saving" | null;
  completed: number;
  total: number;
  questionKey: string | null;
  partKeys: string[];
};

export type AnalysisActivityLabels = {
  queued: string;
  reading: string;
  live: string;
  done: string;
  liveNoKey: string;
  saving: string;
  succeeded: string;
  failed: string;
  open: string;
  close: string;
  sep: string;
};

export type AnalysisActivity = {
  headline: string;
  fraction: string | null;
  percent: number;
  indeterminate: boolean;
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

/** One headline shared by the stepper, the analyse button, and the job panel. */
export function describeAnalysisActivity(
  input: AnalysisActivityInput,
  labels: AnalysisActivityLabels,
): AnalysisActivity {
  const n = normalizeJobStatus(input.status);
  const fraction = input.total > 0 ? `${input.completed}/${input.total}` : null;
  const parts = input.partKeys.map((part) => part.trim()).filter(Boolean);
  const partsText = parts.length ? `${labels.open}${parts.join(labels.sep)}${labels.close}` : "";
  const indeterminate = (n === "ANALYZING" || n === "PENDING") && input.total <= 0;
  let percent = 0;
  if (n === "SUCCEEDED") percent = 100;
  else if (n === "FAILED") {
    percent = input.total > 0 ? Math.round((100 * input.completed) / input.total) : 0;
  } else if (n === "PENDING") percent = 8;
  else if (input.total > 0) {
    percent = Math.min(96, Math.round(12 + 84 * (input.completed / input.total)));
  } else percent = 18;

  const liveVars = {
    key: input.questionKey ?? "",
    parts: partsText,
    completed: input.completed,
    total: input.total > 0 ? input.total : "?",
  };

  let headline = labels.reading;
  if (n === "PENDING") headline = labels.queued;
  else if (n === "FAILED") headline = labels.failed;
  else if (n === "SUCCEEDED") headline = labels.succeeded;
  else if (input.stage === "saving") headline = labels.saving;
  else if (input.stage === "question" && input.questionKey) headline = fill(labels.done, liveVars);
  else if (input.questionKey) headline = fill(labels.live, liveVars);
  else if (input.total > 0) {
    headline = fill(labels.liveNoKey, { completed: input.completed, total: input.total });
  }

  return { headline, fraction, percent, indeterminate };
}

export function formatElapsed(startedAt: string | null | undefined, now: number): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
