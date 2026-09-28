import {
  digestStructureBuffer,
  flattenRawQuestion,
  flattenStructurePayload,
  STRUCTURE_PROMPT_ADDENDUM,
  type FlatStructureQuestion,
} from "@/lib/exams/structure-questions";
import type {
  AnalyzeExamStructureInput,
  AnalyzeExamStructureResult,
  LlmChatRequest,
  LlmChatResponse,
  LlmClient,
  LlmContentPart,
  ScoreSubmissionInput,
  ScoreSubmissionResult,
  StructureProgressUpdate,
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
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
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

  private async *chatDeltas(request: LlmChatRequest): AsyncGenerator<{
    text?: string;
    reasoning?: string;
    finishReason?: string;
  }> {
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
      stream: true,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
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

    if (!response.ok || !response.body) {
      console.error("[llm] stream HTTP", response.status, "model=", request.model);
      if (response.status === 429 || response.status === 503) {
        throw new AppError(ANALYSIS_BUSY, 503, "llm_busy");
      }
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_http_error");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let carry = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const lines = carry.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed: {
          choices?: Array<{
            finish_reason?: string | null;
            delta?: {
              content?: string | null;
              reasoning?: string | null;
              reasoning_content?: string | null;
            };
          }>;
        };
        try {
          parsed = JSON.parse(data) as typeof parsed;
        } catch {
          continue;
        }
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;
        const reasoning = delta?.reasoning || delta?.reasoning_content;
        if (typeof reasoning === "string" && reasoning.trim()) {
          yield { reasoning: reasoning.trim() };
        }
        if (typeof delta?.content === "string" && delta.content) {
          yield { text: delta.content };
        }
        if (choice?.finish_reason) yield { finishReason: choice.finish_reason };
      }
    }
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
    let llmModel = input.modelOverride || this.config.examStructureModel;

    if (!this.config.apiKey && this.config.demoMode) {
      return playDemoStructure(llmModel, input.onProgress);
    }
    if (!this.config.apiKey) {
      throw new AppError(ANALYSIS_NOT_CONFIGURED, 503, "llm_not_configured");
    }

    let pulse: StructureProgressUpdate = {
      stage: "reading",
      completed: 0,
      total: 0,
      questionKey: null,
      partKeys: [],
      note: null,
      commit: false,
    };
    const report = async (update: StructureProgressUpdate) => {
      pulse = update;
      await emitProgress(input, update);
    };
    const beat = setInterval(() => {
      void emitProgress(input, { ...pulse, commit: false, questions: undefined });
    }, 15_000);

    try {
    await report({
      stage: "reading",
      completed: 0,
      total: 0,
      questionKey: null,
      partKeys: [],
      note: null,
      commit: false,
    });

    const assetParts = await this.assetParts(input.assetRefs);
    const request = structureChatRequest(llmModel, input, assetParts);
    let buffer = "";
    let emitted = 0;
    let total = 0;
    const questions: FlatStructureQuestion[] = [];
    let finishReason = "";

    const absorb = async (text: string) => {
      buffer = text;
      const digested = digestStructureBuffer(buffer, emitted);
      total = Math.max(total, digested.total);
      for (const item of digested.fresh) {
        emitted += 1;
        total = Math.max(total, emitted);
        questions.push(...item.rows);
        await report({
          stage: "question",
          completed: emitted,
          total,
          questionKey: item.questionKey,
          partKeys: item.partKeys,
          note: item.note || null,
          commit: true,
          questions: item.rows,
        });
      }
      return digested;
    };

    try {
      let lastDraftAt = 0;
      for await (const delta of this.chatDeltas(request)) {
        if (delta.finishReason) finishReason = delta.finishReason;
        if (delta.reasoning) {
          const now = Date.now();
          if (now - lastDraftAt > 800) {
            lastDraftAt = now;
            await report({
              stage: "receiving",
              completed: emitted,
              total,
              questionKey: null,
              partKeys: [],
              note: delta.reasoning.slice(-180),
              commit: false,
            });
          }
          continue;
        }
        if (!delta.text) continue;
        buffer += delta.text;
        const digested = await absorb(buffer);
        if (digested.draft && Date.now() - lastDraftAt > 700) {
          lastDraftAt = Date.now();
          await report({
            stage: "receiving",
            completed: emitted,
            total: Math.max(total, digested.total),
            questionKey: digested.draft.questionKey,
            partKeys: [],
            note: digested.draft.note,
            commit: false,
          });
        }
      }
    } catch (error) {
      if (!buffer.trim()) {
        const chat = await this.chat(request);
        buffer = chat.content;
        llmModel = chat.llmModel || llmModel;
      } else if (error instanceof AppError && error.code !== "llm_http_error") {
        throw error;
      }
    }

    if (buffer.trim()) {
      await absorb(buffer);
    }

    if (questions.length === 0 && buffer.trim()) {
      try {
        const parsed = flattenStructurePayload(extractJsonObject(buffer));
        if (parsed.length > 0) {
          const grouped = new Map<string, FlatStructureQuestion[]>();
          for (const row of parsed) {
            const list = grouped.get(row.parentKey) ?? [];
            list.push(row);
            grouped.set(row.parentKey, list);
          }
          for (const [questionKey, rows] of grouped) {
            emitted += 1;
            questions.push(...rows);
            await report({
              stage: "question",
              completed: emitted,
              total: Math.max(total, grouped.size),
              questionKey,
              partKeys: rows.map((row) => row.partKey).filter(Boolean),
              note: null,
              commit: true,
              questions: rows,
            });
          }
          total = Math.max(total, grouped.size);
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(sanitizeVendorLeak(ANALYSIS_FAILED_GENERIC), 502, "llm_parse_error");
      }
    }

    if (questions.length === 0) {
      throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_no_questions");
    }
    if (finishReason === "length" && (total === 0 || total > emitted)) {
      throw new AppError(
        "分析未完成，試卷題目未能全部抽出，請再試一次。",
        502,
        "llm_truncated",
      );
    }

    return {
      llmModel,
      questions,
      rawModelText: buffer,
    };
    } finally {
      clearInterval(beat);
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

const DEMO_STRUCTURE_RAW: Array<Record<string, unknown>> = [
  {
    questionKey: "1",
    workingNote: "核對第 1 題是否有 (a)(b)，並抄下題幹。",
    stem: "解下列方程，並寫出檢驗步驟。",
    topic: "algebra",
    itemType: "calculation",
    questionCategory: "計算題",
    maxScore: 6,
    assessmentObjective: "考核能否正確應用一次方程求解並檢驗。",
    difficultyPoints: "易忽略單位換算或符號錯誤。",
    parts: [
      {
        partKey: "a",
        prompt: "求 2x + 3 = 11 的解。",
        maxScore: 2,
        itemType: "calculation",
        assessmentObjective: "考核移項與基本運算。",
        difficultyPoints: "移項時符號容易寫錯。",
      },
      {
        partKey: "b",
        prompt: "把 (a) 的答案代回方程，說明它是否正確。",
        maxScore: 4,
        itemType: "short",
        assessmentObjective: "考核檢驗答案的習慣。",
        difficultyPoints: "學生往往只寫答案，沒有代回原式。",
      },
    ],
  },
  {
    questionKey: "2",
    workingNote: "第 2 題沒有分題，抄錄整題並列出幾何推理難點。",
    stem: "如圖，AB = AC，∠ABC = 50°。求 ∠BAC。",
    topic: "geometry",
    itemType: "short",
    questionCategory: "應用題",
    maxScore: 4,
    assessmentObjective: "考核等腰三角形底角相等的推理。",
    difficultyPoints: "需正確選用等腰三角形底角，步驟易缺漏。",
    parts: [
      {
        partKey: "",
        prompt: "如圖，AB = AC，∠ABC = 50°。求 ∠BAC。",
        maxScore: 4,
        itemType: "short",
      },
    ],
  },
];

function structureChatRequest(
  llmModel: string,
  input: AnalyzeExamStructureInput,
  parts: LlmContentPart[],
): LlmChatRequest {
  const hasSyllabus = input.assetRefs.some((ref) => ref.kind === "SYLLABUS");
  const system = `${(input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPTS.exam_structure).trim()}\n\n${STRUCTURE_PROMPT_ADDENDUM}`;
  return {
    model: llmModel,
    temperature: 0.1,
    maxTokens: 16384,
    responseFormat: "json_object",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Extract the full question paper for exam ${input.examId}. ` +
              "Include every numbered question and every part (a), (b), (c). Copy the question wording in full. " +
              "For each question include 題型 (itemType), 題目種類 (questionCategory), 考核要求 (assessmentObjective), and 難點 (difficultyPoints)." +
              (hasSyllabus ? " Follow the attached syllabus." : ""),
          },
          ...parts,
        ],
      },
    ],
  };
}

async function emitProgress(
  input: AnalyzeExamStructureInput,
  update: StructureProgressUpdate,
): Promise<void> {
  await input.onProgress?.(update);
}

async function playDemoStructure(
  llmModel: string,
  onProgress: AnalyzeExamStructureInput["onProgress"],
): Promise<AnalyzeExamStructureResult> {
  const total = DEMO_STRUCTURE_RAW.length;
  await onProgress?.({
    stage: "reading",
    completed: 0,
    total,
    questionKey: null,
    partKeys: [],
    note: null,
    commit: false,
  });
  const questions: FlatStructureQuestion[] = [];
  let completed = 0;
  for (const raw of DEMO_STRUCTURE_RAW) {
    await sleep(400);
    const rows = flattenRawQuestion(raw);
    completed += 1;
    questions.push(...rows);
    await onProgress?.({
      stage: "question",
      completed,
      total,
      questionKey: rows[0]?.parentKey ?? null,
      partKeys: rows.map((row) => row.partKey).filter(Boolean),
      note: typeof raw.workingNote === "string" ? raw.workingNote : null,
      commit: true,
      questions: rows,
    });
  }
  return { llmModel, questions, rawModelText: '{"demo":true}' };
}

function demoStructureResult(llmModel: string): AnalyzeExamStructureResult {
  return {
    llmModel,
    questions: DEMO_STRUCTURE_RAW.flatMap((item) => flattenRawQuestion(item)),
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
