/**
 * OpenRouter model allowlist for school analysis settings.
 *
 * SchoolSettings.analysisLlmModel MUST be one of these ids (never free-text).
 * Source of truth: env `OPENROUTER_MODEL_ALLOWLIST` (comma-separated), else
 * the built-in DEFAULT_OPENROUTER_MODEL_ALLOWLIST constant below.
 *
 * API keys (OPENROUTER_API_KEY / JINA_API_KEY) stay env-only — never in UI or DB.
 */

/** Fallback allowlist when env is empty — placeholders until product locks models. */
export const DEFAULT_OPENROUTER_MODEL_ALLOWLIST = [
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
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

export function getOpenRouterModelAllowlist(): string[] {
  return parseOpenRouterModelAllowlist();
}

export function isAllowedAnalysisModel(modelId: string): boolean {
  return getOpenRouterModelAllowlist().includes(modelId);
}

/**
 * Validate analysis model for SchoolSettings write.
 * @throws Error if modelId is not on the allowlist
 */
export function assertAllowedAnalysisModel(modelId: string): void {
  if (!isAllowedAnalysisModel(modelId)) {
    throw new Error(
      `analysisLlmModel "${modelId}" is not in the analysis model allowlist`,
    );
  }
}
