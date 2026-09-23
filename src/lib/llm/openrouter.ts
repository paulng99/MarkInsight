import type {
  AnalyzeExamStructureInput,
  AnalyzeExamStructureResult,
  LlmChatRequest,
  LlmChatResponse,
  LlmClient,
  ScoreSubmissionInput,
  ScoreSubmissionResult,
} from "@/lib/llm/types";
import { parseOpenRouterModelAllowlist } from "@/lib/config/openrouter-model-allowlist";
import {
  ANALYSIS_FAILED_GENERIC,
  ANALYSIS_NOT_CONFIGURED,
  AppError,
  sanitizeVendorLeak,
} from "@/lib/errors";
import { isImageMime, toDataUrl } from "@/lib/storage";

/**
 * OpenRouter-backed LLM client.
 *
 * Base URL: OPENROUTER_BASE_URL (default https://openrouter.ai/api/v1)
 * Auth: Authorization: Bearer OPENROUTER_API_KEY
 *
 * When OPENROUTER_API_KEY is missing:
 * - If MARKINSIGHT_ANALYSIS_DEMO=true → deterministic offline results (local verify)
 * - Else → fail with vendor-neutral AppError
 *
 * Product UI must never show vendor brand names.
 */

export type OpenRouterClientConfig = {
  apiKey: string | undefined;
  baseUrl: string;
  /** Default model for exam structure (multimodal). */
  examStructureModel: string;
  /** Default model for student submission scoring (multimodal). */
  scoringModel: string;
  /** Optional OpenRouter ranking headers. */
  siteUrl?: string;
  siteName?: string;
  demoMode: boolean;
};

export function loadOpenRouterConfigFromEnv(): OpenRouterClientConfig {
  const allowlist = parseOpenRouterModelAllowlist();
  const fallback = allowlist[0] ?? "openrouter/auto";
  const structure =
    process.env.OPENROUTER_EXAM_STRUCTURE_MODEL || fallback;
  const scoring = process.env.OPENROUTER_SCORING_MODEL || fallback;

  return {
    apiKey: process.env.OPENROUTER_API_KEY?.trim() || undefined,
    baseUrl:
      process.env.OPENROUTER_BASE_URL?.replace(/\/$/, "") ||
      "https://openrouter.ai/api/v1",
    examStructureModel: structure,
    scoringModel: scoring,
    siteUrl: process.env.OPENROUTER_SITE_URL || undefined,
    siteName: process.env.OPENROUTER_SITE_NAME || "MarkInsight",
    demoMode: process.env.MARKINSIGHT_ANALYSIS_DEMO === "true",
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_parse_error");
  }
}

export class OpenRouterLlmClient implements LlmClient {
  constructor(private readonly config: OpenRouterClientConfig) {}

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    if (!this.config.apiKey) {
      throw new AppError(ANALYSIS_NOT_CONFIGURED, 503, "llm_not_configured");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.config.siteUrl) headers["HTTP-Referer"] = this.config.siteUrl;
    if (this.config.siteName) headers["X-Title"] = this.config.siteName;

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          ...(request.responseFormat === "json_object"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      });
    } catch {
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_network_error");
    }

    if (!response.ok) {
      // Never surface provider body (may contain vendor names) to clients.
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_http_error");
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) {
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_empty_response");
    }

    return {
      content,
      llmModel: data.model || request.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    };
  }

  private async assetParts(
    assetRefs: Array<{ kind: string; storageKey: string; mimeType?: string | null }>,
  ) {
    const parts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [];

    for (const ref of assetRefs) {
      parts.push({
        type: "text",
        text: `Asset kind: ${ref.kind}; key: ${ref.storageKey}`,
      });
      if (isImageMime(ref.mimeType)) {
        const url = await toDataUrl(ref.storageKey, ref.mimeType);
        parts.push({ type: "image_url", image_url: { url } });
      } else {
        // PDF / other: attach as data URL text note — models that accept file URLs
        // via image_url may still ingest; otherwise text context remains.
        try {
          const url = await toDataUrl(
            ref.storageKey,
            ref.mimeType || "application/octet-stream",
          );
          parts.push({
            type: "text",
            text: `File data URL (may be truncated in logs): ${url.slice(0, 120)}…`,
          });
          if ((ref.mimeType || "").startsWith("image/") || ref.mimeType === "application/pdf") {
            parts.push({ type: "image_url", image_url: { url } });
          }
        } catch (error) {
          throw error instanceof AppError
            ? error
            : new AppError("請檢查檔案", 400, "asset_read_error");
        }
      }
    }
    return parts;
  }

  async analyzeExamStructure(
    input: AnalyzeExamStructureInput,
  ): Promise<AnalyzeExamStructureResult> {
    const llmModel = input.modelOverride || this.config.examStructureModel;

    if (!this.config.apiKey && this.config.demoMode) {
      return demoStructureResult(llmModel);
    }
    if (!this.config.apiKey) {
      throw new AppError(ANALYSIS_NOT_CONFIGURED, 503, "llm_not_configured");
    }

    const parts = await this.assetParts(input.assetRefs);

    const chat = await this.chat({
      model: llmModel,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content:
            "You analyze exam papers. Reply with JSON only: " +
            '{"questions":[{"questionKey":"string","topic":"string","itemType":"string","maxScore":number}]}. ' +
            "itemType examples: mcq, short, essay, calculation. No markdown.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract question structure for exam ${input.examId}.`,
            },
            ...parts,
          ],
        },
      ],
    });

    try {
      const parsed = extractJsonObject(chat.content) as {
        questions?: Array<{
          questionKey?: string;
          topic?: string;
          itemType?: string;
          maxScore?: number;
        }>;
      };
      const questions = (parsed.questions ?? [])
        .filter((q) => q.questionKey && q.topic && q.itemType)
        .map((q) => ({
          questionKey: String(q.questionKey),
          topic: String(q.topic),
          itemType: String(q.itemType),
          maxScore: Number(q.maxScore) || 1,
        }));
      if (questions.length === 0) {
        throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_no_questions");
      }
      return {
        llmModel: chat.llmModel || llmModel,
        questions,
        rawModelText: chat.content,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        sanitizeVendorLeak(ANALYSIS_FAILED_GENERIC),
        502,
        "llm_parse_error",
      );
    }
  }

  async scoreSubmission(
    input: ScoreSubmissionInput,
  ): Promise<ScoreSubmissionResult> {
    const llmModel = input.modelOverride || this.config.scoringModel;

    if (!this.config.apiKey && this.config.demoMode) {
      return demoScoreResult(llmModel, input.questions);
    }
    if (!this.config.apiKey) {
      throw new AppError(ANALYSIS_NOT_CONFIGURED, 503, "llm_not_configured");
    }

    const parts = await this.assetParts(input.assetRefs);

    const chat = await this.chat({
      model: llmModel,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content:
            "You score a student exam script. Reply with JSON only: " +
            '{"scores":[{"questionKey":"string","topic":"string","itemType":"string","score":number,"maxScore":number,"feedback":"string"}]}. ' +
            "Use the provided question list. No markdown.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Score submission ${input.submissionId} for exam ${input.examId}. ` +
                `Questions: ${JSON.stringify(input.questions)}`,
            },
            ...parts,
          ],
        },
      ],
    });

    try {
      const parsed = extractJsonObject(chat.content) as {
        scores?: Array<{
          questionKey?: string;
          topic?: string;
          itemType?: string;
          score?: number;
          maxScore?: number;
          feedback?: string;
        }>;
      };
      const byKey = new Map(input.questions.map((q) => [q.questionKey, q]));
      const scores = (parsed.scores ?? [])
        .filter((s) => s.questionKey && byKey.has(String(s.questionKey)))
        .map((s) => {
          const q = byKey.get(String(s.questionKey))!;
          return {
            questionKey: q.questionKey,
            topic: String(s.topic || q.topic),
            itemType: String(s.itemType || q.itemType),
            score: Math.max(0, Number(s.score) || 0),
            maxScore: Number(s.maxScore) || q.maxScore,
            feedback: s.feedback ? String(s.feedback) : undefined,
          };
        });
      if (scores.length === 0) {
        throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_no_scores");
      }
      return {
        llmModel: chat.llmModel || llmModel,
        scores,
        rawModelText: chat.content,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_parse_error");
    }
  }
}

function demoStructureResult(llmModel: string): AnalyzeExamStructureResult {
  return {
    llmModel,
    questions: [
      {
        questionKey: "Q1",
        topic: "algebra",
        itemType: "mcq",
        maxScore: 2,
      },
      {
        questionKey: "Q2",
        topic: "geometry",
        itemType: "short",
        maxScore: 4,
      },
      {
        questionKey: "Q3",
        topic: "algebra",
        itemType: "calculation",
        maxScore: 6,
      },
    ],
    rawModelText: '{"demo":true}',
  };
}

function demoScoreResult(
  llmModel: string,
  questions: AnalyzeExamStructureResult["questions"],
): ScoreSubmissionResult {
  const list =
    questions.length > 0
      ? questions
      : demoStructureResult(llmModel).questions;
  return {
    llmModel,
    scores: list.map((q, i) => ({
      questionKey: q.questionKey,
      topic: q.topic,
      itemType: q.itemType,
      score: Math.max(0, q.maxScore - (i % 3)),
      maxScore: q.maxScore,
      feedback: i === 0 ? "Clear working." : "Review this topic.",
    })),
    rawModelText: '{"demo":true}',
  };
}

/** Factory used by jobs/workers — always OpenRouter for MVP. */
export function createLlmClient(
  config: OpenRouterClientConfig = loadOpenRouterConfigFromEnv(),
): LlmClient {
  return new OpenRouterLlmClient(config);
}
