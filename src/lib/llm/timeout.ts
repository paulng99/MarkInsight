/**
 * Per-request timeout for model HTTP calls.
 * Default 120s; override with MARKINSIGHT_LLM_TIMEOUT_MS.
 */

export const DEFAULT_LLM_TIMEOUT_MS = 120_000;

export const ANALYSIS_TIMEOUT_ZH =
  "分析需時太長，未能完成。檔案已保存，不需要重新上載，請按「重新分析」。";

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
