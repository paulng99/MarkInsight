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
