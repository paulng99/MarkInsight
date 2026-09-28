/**
 * Live analysis-model catalog from the LLM gateway (OpenRouter-compatible).
 *
 * Product UI must never show vendor brand names — only model id / display name.
 * API keys stay env-only.
 */

import {
  DEFAULT_OPENROUTER_MODEL_ALLOWLIST,
  getConfiguredModelAllowlistFilter,
} from "@/lib/config/openrouter-model-allowlist";

export type AnalysisModelChoice = {
  id: string;
  /** Human-readable label from the catalog (may equal id). */
  name: string;
  /** Accepts PDF/file parts. */
  supportsFile: boolean;
  /** Accepts image parts. */
  supportsImage: boolean;
};

type GatewayModel = {
  id?: string;
  name?: string;
  architecture?: {
    input_modalities?: string[];
  };
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { at: number; models: AnalysisModelChoice[] } | null = null;

function envAllowlistFilter(): string[] | null {
  return getConfiguredModelAllowlistFilter();
}

function isPreviewOrBatchId(id: string): boolean {
  return id.startsWith("~") || id.includes(":batch");
}

function toChoice(model: GatewayModel): AnalysisModelChoice | null {
  const id = model.id?.trim();
  if (!id || isPreviewOrBatchId(id)) return null;
  const mods = model.architecture?.input_modalities ?? [];
  const supportsFile = mods.includes("file");
  const supportsImage = mods.includes("image");
  if (!supportsFile && !supportsImage) return null;
  return {
    id,
    name: model.name?.trim() || id,
    supportsFile,
    supportsImage,
  };
}

function fallbackChoices(): AnalysisModelChoice[] {
  const filter = envAllowlistFilter();
  const ids = filter ?? [...DEFAULT_OPENROUTER_MODEL_ALLOWLIST];
  return ids.map((id) => ({
    id,
    name: id,
    supportsFile: true,
    supportsImage: true,
  }));
}

function sortChoices(models: AnalysisModelChoice[]): AnalysisModelChoice[] {
  return [...models].sort((a, b) => {
    if (a.supportsFile !== b.supportsFile) return a.supportsFile ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function applyEnvFilter(models: AnalysisModelChoice[]): AnalysisModelChoice[] {
  const filter = envAllowlistFilter();
  if (!filter) return models;
  const allowed = new Set(filter);
  const filtered = models.filter((m) => allowed.has(m.id));
  // Keep configured ids even if missing from the live catalog (ops override).
  for (const id of filter) {
    if (!filtered.some((m) => m.id === id)) {
      filtered.push({
        id,
        name: id,
        supportsFile: true,
        supportsImage: true,
      });
    }
  }
  return filtered;
}

async function fetchGatewayModels(): Promise<AnalysisModelChoice[]> {
  const baseUrl =
    process.env.OPENROUTER_BASE_URL?.replace(/\/$/, "") ||
    "https://openrouter.ai/api/v1";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim();
  const siteName = process.env.OPENROUTER_SITE_NAME?.trim();
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;
  if (siteName) headers["X-Title"] = siteName;

  const response = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`models_http_${response.status}`);
  }
  const json = (await response.json()) as { data?: GatewayModel[] };
  const choices = (json.data ?? [])
    .map(toChoice)
    .filter((m): m is AnalysisModelChoice => m !== null);
  if (choices.length === 0) {
    throw new Error("models_empty");
  }
  return sortChoices(applyEnvFilter(choices));
}

/**
 * Analysis-capable models for admin pickers.
 * Prefers live gateway catalog; falls back to env/default allowlist.
 */
export async function listAnalysisModelChoices(
  options?: { forceRefresh?: boolean },
): Promise<AnalysisModelChoice[]> {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    cache &&
    now - cache.at < CACHE_TTL_MS &&
    cache.models.length > 0
  ) {
    return cache.models;
  }

  try {
    const models = await fetchGatewayModels();
    cache = { at: now, models };
    return models;
  } catch (error) {
    console.error("[llm] failed to load analysis model catalog", error);
    const models = sortChoices(fallbackChoices());
    cache = { at: now, models };
    return models;
  }
}

export async function isAllowedAnalysisModel(modelId: string): Promise<boolean> {
  const id = modelId.trim();
  if (!id) return false;
  const choices = await listAnalysisModelChoices();
  return choices.some((m) => m.id === id);
}

export async function assertAllowedAnalysisModel(modelId: string): Promise<void> {
  const id = modelId.trim();
  if (!(await isAllowedAnalysisModel(id))) {
    throw new Error(
      `analysisLlmModel "${id}" is not in the analysis model catalog`,
    );
  }
}

/** Ids only — for callers that still expect string[]. */
export async function listAnalysisModelIds(): Promise<string[]> {
  return (await listAnalysisModelChoices()).map((m) => m.id);
}
