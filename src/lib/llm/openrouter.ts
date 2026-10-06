import {
  digestStructureBuffer,
  flattenRawQuestion,
  flattenStructurePayload,
  applySyllabusLabels,
  type SyllabusLabel,
  dedupePartRows,
  limitToMarkAllocation,
  mergeParentRows,
  parentsMissingParts,
  questionsOffMarkAllocation,
  readMarkAllocation,
  replaceParentQuestions,
  scanBatchInstruction,
  scanPageSystemPrompt,
  STRUCTURE_PROMPT_ADDENDUM,
  type DigestedQuestion,
  type FlatStructureQuestion,
} from "@/lib/exams/structure-questions";
import { buildDemoStudyReport, parseSubmissionScorePayload } from "@/lib/exams/study-report";
import type {
  AnalyzeExamStructureInput,
  AnalyzeExamStructureResult,
  LlmChatRequest,
  LlmChatResponse,
  LlmClient,
  LlmContentPart,
  LlmUsageTotals,
  ScoreSubmissionInput,
  ScoreSubmissionResult,
  StructureProgressUpdate,
} from "@/lib/llm/types";
import { parseOpenRouterModelAllowlist } from "@/lib/config/openrouter-model-allowlist";
import { addUsage, emptyUsage, parseProviderUsage, type ProviderUsage } from "@/lib/llm/usage";
import {
  ANALYSIS_BUSY,
  ANALYSIS_FAILED_GENERIC,
  ANALYSIS_NOT_CONFIGURED,
  ANALYSIS_UNSUPPORTED_FILE,
  AppError,
  sanitizeVendorLeak,
} from "@/lib/errors";
import { DEFAULT_SYSTEM_PROMPTS, SCORING_PROMPT_ADDENDUM } from "@/lib/llm/system-prompts";
import {
  ANALYSIS_TIMEOUT_ZH,
  isAbortError,
  llmTimeoutMs,
} from "@/lib/llm/timeout";
import { rasterizeScanPages, type ScanPage } from "@/lib/exams/pdf-page-images";
import { readSyllabusExcerpt } from "@/lib/exams/syllabus-excerpt";
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
 * Each attempt is bounded by MARKINSIGHT_LLM_TIMEOUT_MS (default 120s).
 */
async function fetchChatWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
  model: string,
): Promise<Response> {
  const waitsMs = [0, 12_000, 30_000, 45_000];
  let last: Response | null = null;
  const timeoutMs = llmTimeoutMs();

  for (let attempt = 0; attempt < waitsMs.length; attempt++) {
    if (waitsMs[attempt] > 0) {
      await sleep(waitsMs[attempt]);
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new AppError(ANALYSIS_TIMEOUT_ZH, 504, "llm_timeout");
      }
      throw error;
    }
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
  private usageLedger: LlmUsageTotals = emptyUsage();

  constructor(private readonly config: OpenRouterClientConfig) {}

  snapshotUsage(): LlmUsageTotals {
    return { ...this.usageLedger };
  }

  private recordUsage(usage: ProviderUsage | undefined | null) {
    const parsed = parseProviderUsage(usage);
    if (!parsed) return;
    this.usageLedger = addUsage(this.usageLedger, parsed);
  }

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
      if (isAbortError(error)) {
        throw new AppError(ANALYSIS_TIMEOUT_ZH, 504, "llm_timeout");
      }
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
      usage?: ProviderUsage;
    };

    this.recordUsage(data.usage);

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
        totalTokens: data.usage?.total_tokens,
        costUsd: parseProviderUsage(data.usage)?.costUsd ?? null,
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
      stream_options: { include_usage: true },
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
      if (isAbortError(error)) {
        throw new AppError(ANALYSIS_TIMEOUT_ZH, 504, "llm_timeout");
      }
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
    let streamUsage: ProviderUsage | null = null;
    try {
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
            usage?: ProviderUsage;
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
          if (parsed.usage) streamUsage = parsed.usage;
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
    } finally {
      this.recordUsage(streamUsage);
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
      note: "正在把試卷每一頁轉成可閱讀的圖片。",
      commit: false,
    });

    const scanPages = await rasterizeScanPages(input.assetRefs, async ({ page, pageCount }) => {
      await report({
        stage: "reading",
        completed: page - 1,
        total: pageCount,
        questionKey: null,
        partKeys: [],
        note: `正在把試卷轉成圖片（第 ${page}/${pageCount} 頁）。`,
        commit: false,
      });
    }).catch((error: unknown) => {
      console.error(
        "[llm] page raster failed",
        error instanceof Error ? error.message : "error",
      );
      return [] as ScanPage[];
    });
    const paperPages = scanPages.filter((page) => page.role === "paper");
    if (paperPages.length > 0) {
      const scanned = await this.analyzeScannedPaper(llmModel, input, paperPages, report);
      if (scanned.length === 0) {
        throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_no_questions");
      }
      const classified = await this.classifyAgainstSyllabus(llmModel, input, scanned, report);
      return { llmModel, questions: classified, rawModelText: "" };
    }

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

    const missingParts = parentsMissingParts(questions);
    if (missingParts.length > 0) {
      try {
        const filled = await this.readLetterParts(
          llmModel,
          input,
          assetParts,
          missingParts,
          questions,
          report,
        );
        let merged = questions.slice();
        for (const item of filled) {
          if (item.partKeys.length === 0) continue;
          merged = replaceParentQuestions(merged, item.questionKey, item.rows);
        }
        questions.splice(0, questions.length, ...merged);
      } catch (error) {
        console.error(
          "[llm] part analysis failed",
          error instanceof Error ? error.name : "error",
        );
        await report({
          stage: "receiving",
          completed: emitted,
          total,
          questionKey: null,
          partKeys: [],
          note: "分題分析未完成，已保留各題內容。",
          commit: false,
        });
      }
    }

    const classified = await this.classifyAgainstSyllabus(llmModel, input, questions, report);
    return {
      llmModel,
      questions: classified,
      rawModelText: buffer,
    };
    } finally {
      clearInterval(beat);
    }
  }

  private async analyzeScannedPaper(
    llmModel: string,
    input: AnalyzeExamStructureInput,
    pages: ScanPage[],
    report: (update: StructureProgressUpdate) => Promise<void>,
  ): Promise<FlatStructureQuestion[]> {
    const batches = pageBatches(pages, 4, 3);
    let questions: FlatStructureQuestion[] = [];
    let total = 0;
    const fingerprints = new Map<string, string>();
    const system = scanPageSystemPrompt(
      input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPTS.exam_structure,
    );
    const allocation = await this.readPrintedMarkAllocation(llmModel, pages);

    const absorb = async (
      batch: ScanPage[],
      onlyKeys: string[] | undefined,
      note: string,
    ) => {
      const from = batch[0]?.page ?? 1;
      const to = batch[batch.length - 1]?.page ?? from;
      const parents = new Set(questions.map((row) => row.parentKey));
      await report({
        stage: "receiving",
        completed: parents.size,
        total: Math.max(total, Object.keys(allocation).length, parents.size),
        questionKey: null,
        partKeys: [],
        note,
        commit: false,
      });

      const buffer = await this.completeScanChat(llmModel, system, [
        {
          type: "text",
          text: scanBatchInstruction(from, to, allocation, onlyKeys),
        },
        ...batch.flatMap((page) => [
          {
            type: "text" as const,
            text: `Page ${page.page} of ${page.pageCount}.`,
          },
          { type: "image_url" as const, image_url: { url: page.dataUrl } },
        ]),
      ]);
      if (!buffer.trim()) return;

      try {
        const extra = readMarkAllocation(extractJsonObject(buffer));
        for (const [key, score] of Object.entries(extra)) {
          if (allocation[key] == null) allocation[key] = score;
        }
      } catch {
        // A partial question payload has no marks table.
      }

      let items = digestStructureBuffer(buffer, 0).fresh;
      total = Math.max(total, digestStructureBuffer(buffer, 0).total, Object.keys(allocation).length);
      if (items.length === 0) {
        try {
          const parsed = flattenStructurePayload(extractJsonObject(buffer));
          const grouped = new Map<string, FlatStructureQuestion[]>();
          for (const row of parsed) {
            const list = grouped.get(row.parentKey) ?? [];
            list.push(row);
            grouped.set(row.parentKey, list);
          }
          items = [...grouped.entries()].map(([questionKey, rows]) => ({
            questionKey,
            partKeys: rows.map((row) => row.partKey).filter(Boolean),
            note: "",
            rows,
          }));
        } catch {
          return;
        }
      }

      for (const item of items) {
        if (onlyKeys && !onlyKeys.includes(item.questionKey)) continue;
        if (!usableScanQuestion(item)) continue;
        const fingerprint = item.rows.map((row) => row.prompt.trim()).join("\n");
        const duplicate = [...fingerprints.entries()].find(
          ([key, value]) => key !== item.questionKey && value === fingerprint,
        );
        if (duplicate) continue;
        fingerprints.set(item.questionKey, fingerprint);
        const expected = allocation[item.questionKey];
        questions = mergeParentRows(questions, item.rows, expected);
        const rows = questions.filter((row) => row.parentKey === item.questionKey);
        const sum = rows.reduce((score, row) => score + (row.maxScore || 0), 0);
        if (expected && sum !== expected) continue;
        const done = new Set(questions.map((row) => row.parentKey));
        await report({
          stage: "question",
          completed: done.size,
          total: Math.max(total, Object.keys(allocation).length, done.size),
          questionKey: item.questionKey,
          partKeys: rows.map((row) => row.partKey).filter(Boolean),
          note: item.note || "已分析此題的分題。",
          commit: true,
          replaceParentKeys: [item.questionKey],
          questions: rows,
        });
      }
    };

    for (const batch of batches) {
      const from = batch[0]?.page ?? 1;
      const to = batch[batch.length - 1]?.page ?? from;
      await absorb(
        batch,
        undefined,
        `正在閱讀第 ${from}–${to} 頁，逐項抄錄分題、分數、考核要求同難點。`,
      );
    }

    let pending = questionsOffMarkAllocation(questions, allocation);
    if (pending.length > 0) {
      for (const batch of batches) {
        pending = questionsOffMarkAllocation(questions, allocation);
        if (pending.length === 0) break;
        const from = batch[0]?.page ?? 1;
        const to = batch[batch.length - 1]?.page ?? from;
        await absorb(
          batch,
          pending,
          `正在按封面分數表核對第 ${pending.join("、")} 題（第 ${from}–${to} 頁）。`,
        );
      }
    }

    questions = limitToMarkAllocation(dedupePartRows(questions), allocation);
    const off = questionsOffMarkAllocation(questions, allocation);
    if (off.length > 0) {
      throw new AppError(
        `分析未完成，第 ${off.join("、")} 題的分數同封面分數表不符，請再試一次。`,
        502,
        "llm_marks_mismatch",
      );
    }
    return questions;
  }

  private async readPrintedMarkAllocation(
    llmModel: string,
    pages: ScanPage[],
  ): Promise<Record<string, number>> {
    const head = pages.slice(0, 2);
    if (head.length === 0) return {};
    const content: LlmContentPart[] = [
      {
        type: "text",
        text:
          "Look only for a printed marks table (Question No. / Marks, or 題號 / 分數). " +
          'Return JSON {"allocation":[{"questionKey":"1","maxScore":5}]}. ' +
          "questionKey is the question number. maxScore is that question's total marks from the table, not a part mark. " +
          'If no marks table is visible, return {"allocation":[]}. Do not extract question text.',
      },
      ...head.flatMap((page) => [
        { type: "text" as const, text: `Page ${page.page}.` },
        { type: "image_url" as const, image_url: { url: page.dataUrl } },
      ]),
    ];
    try {
      const chat = await this.chat({
        model: llmModel,
        temperature: 0,
        maxTokens: 1024,
        responseFormat: "json_object",
        messages: [
          {
            role: "system",
            content: "You read a marks table from an exam cover. Reply with JSON only.",
          },
          { role: "user", content },
        ],
      });
      return readMarkAllocation(extractJsonObject(chat.content));
    } catch (error) {
      console.error(
        "[llm] marks table failed",
        error instanceof Error ? error.name : "error",
      );
      return {};
    }
  }

  private async completeScanChat(
    llmModel: string,
    system: string,
    content: LlmContentPart[],
  ): Promise<string> {
    const request: LlmChatRequest = {
      model: llmModel,
      temperature: 0.1,
      maxTokens: 8192,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    };
    let buffer = "";
    try {
      for await (const delta of this.chatDeltas(request)) {
        if (delta.text) buffer += delta.text;
      }
    } catch (error) {
      if (!buffer.trim()) {
        try {
          const chat = await this.chat(request);
          buffer = chat.content;
        } catch (fallbackError) {
          console.error(
            "[llm] page batch failed",
            fallbackError instanceof Error ? fallbackError.name : "error",
          );
          return "";
        }
      } else if (error instanceof AppError && error.code !== "llm_http_error") {
        throw error;
      }
    }
    return buffer;
  }

  async classifyAgainstSyllabus(
    llmModel: string,
    input: AnalyzeExamStructureInput,
    questions: FlatStructureQuestion[],
    report: (update: StructureProgressUpdate) => Promise<void>,
  ): Promise<FlatStructureQuestion[]> {
    if (!input.assetRefs.some((ref) => ref.kind === "SYLLABUS") || questions.length === 0) {
      return questions;
    }
    const parents = new Set(questions.map((row) => row.parentKey));
    await report({
      stage: "receiving",
      completed: parents.size,
      total: parents.size,
      questionKey: null,
      partKeys: [],
      note: "正在對照已上載的教學大綱，以中英對照寫出教學內容、題型同題目種類。 Matching the uploaded syllabus and writing teaching content, item type, and question category in Chinese and English.",
      commit: false,
    });

    let excerpt = "";
    try {
      excerpt = await readSyllabusExcerpt(input.assetRefs, [
        ...new Set(questions.map((row) => row.topic).filter((topic) => topic && topic !== "—")),
      ]);
    } catch (error) {
      console.error(
        "[llm] syllabus read failed",
        error instanceof Error ? error.name : "error",
      );
      return questions;
    }
    if (!excerpt) return questions;

    const labels: SyllabusLabel[] = [];
    const size = 6;
    for (let start = 0; start < questions.length; start += size) {
      const slice = questions.slice(start, start + size);
      try {
        labels.push(...(await this.classifySyllabusSlice(llmModel, excerpt, slice)));
      } catch (error) {
        console.error(
          "[llm] syllabus classification failed",
          error instanceof Error ? error.name : "error",
        );
      }
    }
    if (labels.length === 0) return questions;
    const next = applySyllabusLabels(questions, labels);
    const changed = new Set<string>();
    for (let i = 0; i < questions.length; i++) {
      const before = questions[i];
      const after = next[i];
      if (!before || !after) continue;
      if (
        after.itemTypeZh !== before.itemTypeZh ||
        after.itemTypeEn !== before.itemTypeEn ||
        after.questionCategoryZh !== before.questionCategoryZh ||
        after.questionCategoryEn !== before.questionCategoryEn ||
        after.topicZh !== before.topicZh ||
        after.topicEn !== before.topicEn ||
        after.teachingContentZh !== before.teachingContentZh ||
        after.teachingContentEn !== before.teachingContentEn ||
        after.assessmentObjectiveZh !== before.assessmentObjectiveZh ||
        after.assessmentObjectiveEn !== before.assessmentObjectiveEn ||
        after.difficultyPointsZh !== before.difficultyPointsZh ||
        after.difficultyPointsEn !== before.difficultyPointsEn
      ) {
        changed.add(after.parentKey);
      }
    }
    let cursor = 0;
    for (const parent of changed) {
      cursor += 1;
      const rows = next.filter((row) => row.parentKey === parent);
      await report({
        stage: "question",
        completed: cursor,
        total: changed.size,
        questionKey: parent,
        partKeys: rows.map((row) => row.partKey).filter(Boolean),
        note: "已按教學大綱以中英對照寫出教學內容、題型與題目種類。 Wrote teaching content, item type, and question category in Chinese and English from the syllabus.",
        commit: true,
        replaceParentKeys: [parent],
        questions: rows,
      });
    }
    return next;
  }

  private async classifySyllabusSlice(
    llmModel: string,
    excerpt: string,
    questions: FlatStructureQuestion[],
  ): Promise<SyllabusLabel[]> {
    const brief = questions.map((row) => ({
      questionKey: row.questionKey,
      prompt: row.prompt.slice(0, 400),
      assessmentObjective: row.assessmentObjectiveZh || row.assessmentObjective,
      difficultyPoints: row.difficultyPointsZh || row.difficultyPoints,
    }));
    const request: LlmChatRequest = {
      model: llmModel,
      temperature: 0.1,
      maxTokens: 8000,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content:
            "You classify exam parts against an uploaded syllabus. Reply with JSON only. " +
            "Every text field must have a Traditional Chinese (Hong Kong) version and an English version. " +
            '{"questions":[{"questionKey":"1(a)","itemTypeZh":"","itemTypeEn":"","questionCategoryZh":"","questionCategoryEn":"","topicZh":"","topicEn":"","teachingContentZh":"","teachingContentEn":"","assessmentObjectiveZh":"","assessmentObjectiveEn":"","difficultyPointsZh":"","difficultyPointsEn":""}]}',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Use only the syllabus excerpt below. Write every field in Traditional Chinese (Hong Kong) and in English. Do not leave either language blank.\n" +
                "itemTypeZh is 題型 and itemTypeEn is its English name. Use only the kinds of items the syllabus lists together: " +
                "多項選擇題 / Multiple-choice question, 短題目 / Short question, 結構題 / Structured question, 論述題 / Essay. " +
                "Use 短題目 for a brief reason, a single fact, or a direction. Use 結構題 for a calculation, derivation, or multi-step account. " +
                "Use 論述題 only for an extended discussion, and 多項選擇題 only when options are printed. " +
                "Do not invent formats such as 計算題, 推導題, 解釋題, 選擇題, or 實驗設計題.\n" +
                "questionCategory is 題目種類. Choose the one assessment objective in the syllabus that best fits that part. " +
                "questionCategoryZh is Traditional Chinese and questionCategoryEn is the matching English. " +
                "Do not give every part the same category. " +
                "Apparatus or an experimental procedure maps to the experiment objective. Uncertainty or error maps to the errors objective. " +
                "A table, graph, or reading maps to presenting or analysing data. A numerical solution maps to applying knowledge to solve a problem. " +
                "An explanation of a phenomenon maps to applying knowledge to explain. Stating a fact maps to recall and understanding. " +
                "Do not use a curriculum heading such as Skills and Processes or Values and Attitudes as the category.\n" +
                "topicZh and topicEn are the syllabus topic name in Chinese and English.\n" +
                "teachingContent is 教學內容 / Teaching content. From Students should learn / Students should be able to, write the curriculum points this part assesses. " +
                "teachingContentZh and teachingContentEn must say the same points. State what students are taught. Do not copy or paraphrase the exam question.\n" +
                "assessmentObjective is 考核要求 / Assessment requirement. Translate the supplied assessment into both languages, keeping the same demand. " +
                "difficultyPoints is 難點 / Difficulty points. Translate the supplied difficulty into both languages, keeping the same point.\n" +
                "Return one object for every questionKey.\n\n" +
                `Syllabus excerpt:\n${excerpt}\n\nParts:\n${JSON.stringify(brief)}`,
            },
          ],
        },
      ],
    };
    const chat = await this.chat(request);
    const parsed = extractJsonObject(chat.content) as { questions?: SyllabusLabel[] };
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  }

  private async readLetterParts(
    llmModel: string,
    input: AnalyzeExamStructureInput,
    assetParts: LlmContentPart[],
    missing: string[],
    current: FlatStructureQuestion[],
    report: (update: StructureProgressUpdate) => Promise<void>,
  ): Promise<DigestedQuestion[]> {
    await report({
      stage: "receiving",
      completed: 0,
      total: missing.length,
      questionKey: missing[0] ?? null,
      partKeys: [],
      note: "正在拆開每一題的分題，並逐項寫考核要求與難點。",
      commit: false,
    });

    const request: LlmChatRequest = {
      model: llmModel,
      temperature: 0.1,
      maxTokens: 16384,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content: [
            "You analyse lettered parts of a Hong Kong exam paper.",
            "Reply with JSON only:",
            '{"questions":[{"questionKey":"1","workingNote":"string","stem":"shared stem","parts":[{"partKey":"a","prompt":"full part text","maxScore":1,"itemType":"short","assessmentObjective":"string","difficultyPoints":"string"}]}]}',
            "Every listed question has parts on the paper, such as (a), (b), (c), (i), (ii), or （甲）（乙）.",
            "Copy each part's wording in full. Do not summarise, translate, or merge parts into the stem.",
            "partKey is the letter or numeral without brackets, for example a or ii.",
            "An empty partKey is invalid.",
            "Each part needs its own maxScore, assessmentObjective (考核要求), and difficultyPoints (難點).",
            "Write assessmentObjective and difficultyPoints in Traditional Chinese (Hong Kong), about that part only.",
            "Use the questionKey values exactly as given.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `These numbered questions still need part-by-part analysis: ${missing.join(", ")}. ` +
                "Read the question paper. For each questionKey return every part in order, with the full part text and a separate analysis of that part.",
            },
            ...assetParts,
          ],
        },
      ],
    };

    let buffer = "";
    let emitted = 0;
    const found: DigestedQuestion[] = [];
    const wanted = new Set(missing);

    const accept = async (item: DigestedQuestion) => {
      if (!wanted.has(item.questionKey) || item.partKeys.length === 0) return;
      const previous = current.find((row) => row.parentKey === item.questionKey);
      const rows = item.rows.map((row) => ({
        ...row,
        topic: row.topic && row.topic !== "—" ? row.topic : previous?.topic || row.topic,
        questionCategory: row.questionCategory || previous?.questionCategory || "",
        itemType: row.itemType && row.itemType !== "short" ? row.itemType : previous?.itemType || row.itemType,
      }));
      const next = { ...item, rows };
      found.push(next);
      await report({
        stage: "question",
        completed: found.length,
        total: missing.length,
        questionKey: item.questionKey,
        partKeys: item.partKeys,
        note: item.note || "已分析此題的分題。",
        commit: true,
        replaceParentKeys: [item.questionKey],
        questions: rows,
      });
    };

    const take = async (text: string) => {
      const digested = digestStructureBuffer(text, emitted);
      for (const item of digested.fresh) {
        emitted += 1;
        await accept(item);
      }
    };

    try {
      for await (const delta of this.chatDeltas(request)) {
        if (!delta.text) continue;
        buffer += delta.text;
        await take(buffer);
      }
    } catch (error) {
      if (!buffer.trim()) {
        const chat = await this.chat(request);
        buffer = chat.content;
      } else if (error instanceof AppError && error.code !== "llm_http_error") {
        throw error;
      }
    }

    if (buffer.trim()) await take(buffer);
    if (found.length === 0 && buffer.trim()) {
      const parsed = flattenStructurePayload(extractJsonObject(buffer));
      const grouped = new Map<string, FlatStructureQuestion[]>();
      for (const row of parsed) {
        const list = grouped.get(row.parentKey) ?? [];
        list.push(row);
        grouped.set(row.parentKey, list);
      }
      for (const [questionKey, rows] of grouped) {
        const partKeys = rows.map((row) => row.partKey).filter(Boolean);
        if (!wanted.has(questionKey) || partKeys.length === 0) continue;
        const item: DigestedQuestion = { questionKey, partKeys, note: "", rows };
        await accept(item);
      }
    }

    return found;
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

    const system = `${(input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPTS.submission_scoring).trim()}\n\n${SCORING_PROMPT_ADDENDUM}`;
    const chat = await this.chat({
      model: llmModel,
      temperature: 0.2,
      maxTokens: 16384,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Score every question on submission ${input.submissionId} for exam ${input.examId}. ` +
                "Write a revision report the student can study from. " +
                "For each question, use assessmentObjective and difficultyPoints when present, then say what this student did well, the specific weakness, the mistakes to watch next time, and how to improve. " +
                `Questions: ${JSON.stringify(input.questions)}`,
            },
            ...parts,
          ],
        },
      ],
    });

    try {
      const parsed = parseSubmissionScorePayload(extractJsonObject(chat.content), input.questions);
      if (parsed.scores.length === 0) {
        throw new AppError(ANALYSIS_FAILED_GENERIC, 502, "llm_no_scores");
      }
      return {
        llmModel: chat.llmModel || llmModel,
        studyFocusZh: parsed.studyFocusZh,
        studyFocusEn: parsed.studyFocusEn,
        scores: parsed.scores,
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

function pageBatches<T>(pages: T[], size: number, stride: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < pages.length; index += stride) {
    batches.push(pages.slice(index, index + size));
    if (index + size >= pages.length) break;
  }
  return batches;
}

function usableScanQuestion(item: DigestedQuestion): boolean {
  if (!/^\d+$/.test(item.questionKey)) return false;
  if (item.partKeys.length === 0) return false;
  if (item.rows.some((row) => /shared stem/i.test(`${row.stem} ${row.prompt}`))) return false;
  return item.rows.some((row) => row.prompt.trim().length >= 15);
}

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
  const report = buildDemoStudyReport(list);
  return {
    llmModel,
    studyFocusZh: report.studyFocusZh,
    studyFocusEn: report.studyFocusEn,
    scores: report.scores,
    rawModelText: '{"demo":true}',
  };
}

/** Factory used by jobs/workers — always OpenRouter for MVP. */
export function createLlmClient(
  config: OpenRouterClientConfig = loadOpenRouterConfigFromEnv(),
): LlmClient {
  return new OpenRouterLlmClient(config);
}
