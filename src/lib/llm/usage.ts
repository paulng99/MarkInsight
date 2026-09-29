import type { LlmUsageTotals } from "@/lib/llm/types";

export type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  cost_details?: { upstream_inference_cost?: number };
};

export function emptyUsage(): LlmUsageTotals {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: null,
    costComplete: true,
    callCount: 0,
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readCostUsd(usage: ProviderUsage): number | null {
  const direct = finiteNumber(usage.cost);
  if (direct != null) return direct;
  return finiteNumber(usage.cost_details?.upstream_inference_cost);
}

/** One provider usage object. Returns null when the payload has no figures. */
export function parseProviderUsage(usage: ProviderUsage | undefined | null): LlmUsageTotals | null {
  if (!usage) return null;
  const promptTokens = finiteNumber(usage.prompt_tokens) ?? 0;
  const completionTokens = finiteNumber(usage.completion_tokens) ?? 0;
  const reportedTotal = finiteNumber(usage.total_tokens);
  const totalTokens = reportedTotal ?? promptTokens + completionTokens;
  const costUsd = readCostUsd(usage);
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0 && costUsd == null) {
    return null;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    costComplete: costUsd != null,
    callCount: 1,
  };
}

export function addUsage(left: LlmUsageTotals, right: LlmUsageTotals): LlmUsageTotals {
  const costUsd =
    left.costUsd == null && right.costUsd == null
      ? null
      : (left.costUsd ?? 0) + (right.costUsd ?? 0);
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    completionTokens: left.completionTokens + right.completionTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    costUsd,
    costComplete: left.costComplete && right.costComplete,
    callCount: left.callCount + right.callCount,
  };
}

export function sumUsage(parts: LlmUsageTotals[]): LlmUsageTotals {
  return parts.reduce(addUsage, emptyUsage());
}
