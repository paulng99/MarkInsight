/**
 * OpenRouter model allowlist helpers (env filter + defaults).
 *
 * Live catalog lives in `@/lib/llm/openrouter-models`.
 * When `OPENROUTER_MODEL_ALLOWLIST` is set, admin pickers are restricted to those ids.
 * When empty, the live gateway catalog is used (with this default list as fallback).
 *
 * API keys (OPENROUTER_API_KEY / JINA_API_KEY) stay env-only — never in UI or DB.
 */

/**
 * Fallback allowlist when the live catalog is unavailable and env is empty.
 * Prefer multimodal models that accept PDF `file` parts and are available in HK
 * (Gemini / GPT often geo-blocked via OpenRouter from Hong Kong).
 */
export const DEFAULT_OPENROUTER_MODEL_ALLOWLIST = [
  "qwen/qwen2.5-vl-72b-instruct",
  "mistralai/mistral-small-3.1-24b-instruct",
  "deepseek/deepseek-v4-pro-0813",
  "openrouter/auto",
] as const;

export function parseOpenRouterModelAllowlist(
  raw: string | undefined = process.env.OPENROUTER_MODEL_ALLOWLIST,
): string[] {
  const fromEnv = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return [...DEFAULT_OPENROUTER_MODEL_ALLOWLIST];
}

/**
 * Env-configured filter only (null when OPENROUTER_MODEL_ALLOWLIST is unset/empty).
 * Does not fall back to DEFAULT — that is for offline catalog fallback only.
 */
export function getConfiguredModelAllowlistFilter(): string[] | null {
  const raw = process.env.OPENROUTER_MODEL_ALLOWLIST;
  if (raw === undefined || raw.trim() === "") return null;
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : null;
}

/** @deprecated Prefer listAnalysisModelChoices() from openrouter-models. */
export function getOpenRouterModelAllowlist(): string[] {
  return parseOpenRouterModelAllowlist();
}

/** Sync check against env/default list only (legacy). Prefer async catalog assert. */
export function isAllowedAnalysisModelSync(modelId: string): boolean {
  return getOpenRouterModelAllowlist().includes(modelId);
}
