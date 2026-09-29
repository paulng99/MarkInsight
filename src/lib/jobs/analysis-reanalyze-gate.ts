import { normalizeJobStatus } from "./status-copy";

/** Idle window before an active PENDING/RUNNING job is treated as stalled and re-analyze is allowed. */
export const ANALYSIS_STALL_IDLE_MS = 3 * 60 * 1000;

/**
 * Idle window before showing the “waiting to re-analyze” hint.
 * Only after this long without a progress touch do we treat the job as possibly interrupted.
 */
export const ANALYSIS_WAITING_HINT_IDLE_MS = 60_000;

export type AnalysisReanalyzeGateInput = {
  /** Raw job status (PENDING, RUNNING, ANALYZING, …). */
  jobStatus: string | null | undefined;
  /** Last progress update or job start (ISO). Missing means idle age stays 0. */
  touchedAt: string | null | undefined;
  now: number;
  /** True while the client has POSTed analyze and awaits a real job id. */
  startingAnalysis?: boolean;
};

export type AnalysisReanalyzeGate = {
  jobActive: boolean;
  stalled: boolean;
  /** Disabled specifically because the job is still PENDING/RUNNING (not yet stalled). */
  blockedByActiveJob: boolean;
  /** Show the waiting copy next to the re-analyze control (suspected interruption only). */
  showWaitingHint: boolean;
};

/**
 * Shared gate for the teacher exam “re-analyze” control.
 * Stall uses the existing three-minute idle threshold; the waiting hint uses a separate one-minute idle threshold.
 */
export function resolveAnalysisReanalyzeGate(
  input: AnalysisReanalyzeGateInput,
): AnalysisReanalyzeGate {
  const phase = input.jobStatus ? normalizeJobStatus(input.jobStatus) : null;
  const jobActive = phase === "PENDING" || phase === "ANALYZING";
  const idleMs = input.touchedAt ? input.now - new Date(input.touchedAt).getTime() : 0;
  const startingAnalysis = Boolean(input.startingAnalysis);
  const stalled = jobActive && !startingAnalysis && idleMs > ANALYSIS_STALL_IDLE_MS;
  const blockedByActiveJob = startingAnalysis || (jobActive && !stalled);
  // Suspected interruption only: active job, not the brief client start, idle past one minute.
  // Past three minutes, blockedByActiveJob is already false so the hint stays hidden.
  const showWaitingHint =
    blockedByActiveJob &&
    !startingAnalysis &&
    idleMs > ANALYSIS_WAITING_HINT_IDLE_MS;

  return {
    jobActive,
    stalled,
    blockedByActiveJob,
    showWaitingHint,
  };
}
