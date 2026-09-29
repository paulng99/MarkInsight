import { normalizeJobStatus } from "./status-copy";

/** Idle window before an active PENDING/RUNNING job is treated as stalled and re-analyze is allowed. */
export const ANALYSIS_STALL_IDLE_MS = 3 * 60 * 1000;

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
  /** Show the waiting copy next to the re-analyze control. */
  showWaitingHint: boolean;
};

/**
 * Shared gate for the teacher exam “re-analyze” control.
 * Reuses the existing idle / startedAt / progress touch threshold — do not invent a second one.
 */
export function resolveAnalysisReanalyzeGate(
  input: AnalysisReanalyzeGateInput,
): AnalysisReanalyzeGate {
  const phase = input.jobStatus ? normalizeJobStatus(input.jobStatus) : null;
  const jobActive = phase === "PENDING" || phase === "ANALYZING";
  const idleMs = input.touchedAt ? input.now - new Date(input.touchedAt).getTime() : 0;
  const stalled =
    jobActive && !input.startingAnalysis && idleMs > ANALYSIS_STALL_IDLE_MS;
  const blockedByActiveJob =
    Boolean(input.startingAnalysis) || (jobActive && !stalled);

  return {
    jobActive,
    stalled,
    blockedByActiveJob,
    // Only for RUNNING/PENDING (and client starting) disable — not other reasons such as missing paper.
    showWaitingHint: blockedByActiveJob,
  };
}
