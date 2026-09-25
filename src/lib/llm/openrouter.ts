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
  ANALYSIS_BUSY,
  ANALYSIS_FAILED_GENERIC,
  ANALYSIS_NOT_CONFIGURED,
  ANALYSIS_UNSUPPORTED_FILE,
  AppError,
  sanitizeVendorLeak,
} from "@/lib/errors";
import { DEFAULT_SYSTEM_PROMPTS } from "@/lib/llm/system-prompts";
import { getObjectBytes, isImageMime, isPdfMime, toDataUrl } from "@/lib/storage";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Large multimodal requests often hit provider rate limits (429).
 * Retry those, and brief 503s, before failing the job.
 */
async function fetchChatWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
  model: string,
): Promise<Response> {
  const waitsMs = [0, 12_000, 30_000, 45_000];
  let last: Response | null = null;

  for (let attempt = 0; attempt < waitsMs.length; attempt++) {
    if (waitsMs[attempt] > 0) {
      await sleep(waitsMs[attempt]);
    }
    const response = await fetch(url, { method: "POST", headers, body });
    if (response.ok) return response;
    last = response;
    const retryable = response.status === 429 || response.status === 503;
    console.error(
      "[llm] chat HTTP",
      response.status,
      "model=",
      model,
      "attempt=",
      attempt + 1,
    );
    if (!retryable) return response;
  }

  if (!last) {
    throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_network_error");
  }
  return last;
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

    const payload = JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      ...(request.responseFormat === "json_object"
        ? { response_format: { type: "json_object" } }
        : {}),
    });

    let response: Response;
    try {
      response = await fetchChatWithRetry(
        `${this.config.baseUrl}/chat/completions`,
        headers,
        payload,
        request.model,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_network_error");
    }

    if (!response.ok) {
      // Never surface provider body (may contain vendor names) to clients.
      console.error("[llm] chat HTTP", response.status, "model=", request.model);
      if (response.status === 429 || response.status === 503) {
        throw new AppError(ANALYSIS_BUSY, 503, "llm_busy");
      }
      if (response.status === 400 || response.status === 415 || response.status === 413) {
        throw new AppError(ANALYSIS_UNSUPPORTED_FILE, 502, "llm_http_error");
      }
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
      console.error("[llm] empty content model=", request.model);
      throw new AppError(
        "Analysis failed. The selected model returned no result for this file. Try another analysis model or re-upload as JPEG/PNG.",
        502,
        "llm_empty_response",
      );
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
      | { type: "file"; file: { filename: string; file_data: string } }
    > = [];

    for (const ref of assetRefs) {
      parts.push({
        type: "text",
        text: `Asset kind: ${ref.kind}; key: ${ref.storageKey}`,
      });
      try {
        if ((ref.mimeType || "").startsWith("text/")) {
          const text = (await getObjectBytes(ref.storageKey)).toString("utf8").slice(0, 80_000);
          parts.push({
            type: "text",
            text: `Syllabus / text content:\n${text}`,
          });
          continue;
        }

        if (isImageMime(ref.mimeType)) {
          const url = await toDataUrl(ref.storageKey, ref.mimeType);
          parts.push({ type: "image_url", image_url: { url } });
          continue;
        }

        // PDFs must use OpenRouter `file` parts — many vision models reject
        // application/pdf when sent as image_url (only png/jpeg/webp/gif).
        if (isPdfMime(ref.mimeType) || ref.storageKey.toLowerCase().endsWith(".pdf")) {
          const url = await toDataUrl(ref.storageKey, "application/pdf");
          const filename =
            ref.storageKey.split("/").pop()?.replace(/[^\w.\-]+/g, "_") ||
            "document.pdf";
          parts.push({
            type: "file",
            file: { filename, file_data: url },
          });
          continue;
        }

        parts.push({
          type: "text",
          text: `Unsupported asset mime ${ref.mimeType || "unknown"}; upload PDF or image.`,
        });
      } catch (error) {
        throw error instanceof AppError
          ? error
          : new AppError("請檢查檔案", 400, "asset_read_error");
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
    const hasSyllabus = input.assetRefs.some((ref) => ref.kind === "SYLLABUS");

    const chat = await this.chat({
      model: llmModel,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content: input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPTS.exam_structure,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Extract full question structure for exam ${input.examId}. ` +
                "For each question include 題型 (itemType), 題目種類 (questionCategory), 考核要求 (assessmentObjective), and 難點 (difficultyPoints)." +
                (hasSyllabus ? " Follow the attached syllabus." : ""),
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
          questionCategory?: string;
          maxScore?: number;
          assessmentObjective?: string;
          difficultyPoints?: string;
          /** Accept alternate keys some models invent. */
          objective?: string;
          difficulty?: string;
          hardPoints?: string;
        }>;
      };
      const questions = (parsed.questions ?? [])
        .filter((q) => q.questionKey && q.topic && q.itemType)
        .map((q) => ({
          questionKey: String(q.questionKey),
          topic: String(q.topic),
          itemType: String(q.itemType),
          questionCategory: String(q.questionCategory || "").trim(),
          maxScore: Number(q.maxScore) || 1,
          assessmentObjective: String(
            q.assessmentObjective || q.objective || "",
          ).trim(),
          difficultyPoints: String(
            q.difficultyPoints || q.difficulty || q.hardPoints || "",
          ).trim(),
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
          content: input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPTS.submission_scoring,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Score submission ${input.submissionId} for exam ${input.examId}. ` +
                `Questions (with 考核目的 / 難點 when available): ${JSON.stringify(input.questions)}`,
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
        questionCategory: "概念題",
        maxScore: 2,
        assessmentObjective: "考核能否正確應用一次方程求解。",
        difficultyPoints: "易忽略單位換算或符號錯誤。",
      },
      {
        questionKey: "Q2",
        topic: "geometry",
        itemType: "short",
        questionCategory: "應用題",
        maxScore: 4,
        assessmentObjective: "考核平面幾何推理與定理應用。",
        difficultyPoints: "需正確選用相似／全等條件，步驟易缺漏。",
      },
      {
        questionKey: "Q3",
        topic: "algebra",
        itemType: "calculation",
        questionCategory: "計算題",
        maxScore: 6,
        assessmentObjective: "考核多步驟代數運算與檢驗答案。",
        difficultyPoints: "展開與因式分解易出錯；未驗算。",
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
