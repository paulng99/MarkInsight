/**
 * Per-request timeout for model HTTP calls.
 * Default 120s; override with MARKINSIGHT_LLM_TIMEOUT_MS.
 */

export const DEFAULT_LLM_TIMEOUT_MS = 120_000;

export const ANALYSIS_TIMEOUT_ZH =
  "分析花了太長時間，未能完成。你可以重新分析。";

export function llmTimeoutMs(): number {
  const raw = process.env.MARKINSIGHT_LLM_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_LLM_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return DEFAULT_LLM_TIMEOUT_MS;
  return Math.floor(n);
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "TimeoutError";
}
