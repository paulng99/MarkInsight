import type {
  AnalyzeExamStructureInput,
  AnalyzeExamStructureResult,
  LlmChatRequest,
  LlmChatResponse,
  LlmClient,
  ScoreSubmissionInput,
  ScoreSubmissionResult,
} from "@/lib/llm/types";

/**
 * OpenRouter-backed LLM client (scaffold stub).
 *
 * Base URL: OPENROUTER_BASE_URL (default https://openrouter.ai/api/v1)
 * Auth: Authorization: Bearer OPENROUTER_API_KEY
 *
 * No live HTTP in this PR — methods throw or return empty stubs with TODO markers.
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
};

export function loadOpenRouterConfigFromEnv(): OpenRouterClientConfig {
  return {
    apiKey: process.env.OPENROUTER_API_KEY || undefined,
    baseUrl:
      process.env.OPENROUTER_BASE_URL?.replace(/\/$/, "") ||
      "https://openrouter.ai/api/v1",
    examStructureModel:
      process.env.OPENROUTER_EXAM_STRUCTURE_MODEL ||
      "openrouter/auto",
    scoringModel:
      process.env.OPENROUTER_SCORING_MODEL || "openrouter/auto",
    siteUrl: process.env.OPENROUTER_SITE_URL || undefined,
    siteName: process.env.OPENROUTER_SITE_NAME || "MarkInsight",
  };
}

export class OpenRouterLlmClient implements LlmClient {
  constructor(private readonly config: OpenRouterClientConfig) {}

  async chat(_request: LlmChatRequest): Promise<LlmChatResponse> {
    // TODO(knife-1): POST `${baseUrl}/chat/completions` with Bearer OPENROUTER_API_KEY.
    // TODO(knife-1): Map multimodal messages (image_url / file refs) per OpenRouter docs.
    // Do NOT perform live API calls in the scaffold.
    void this.config;
    throw new Error(
      "OpenRouterLlmClient.chat is not implemented (scaffold stub — no live API calls).",
    );
  }

  async analyzeExamStructure(
    input: AnalyzeExamStructureInput,
  ): Promise<AnalyzeExamStructureResult> {
    // TODO(knife-1): Build multimodal prompt from assetRefs + call this.chat with examStructureModel.
    // TODO(knife-1): Parse JSON → questions[{ questionKey, topic, itemType, maxScore }].
    console.info("[llm/openrouter] stub analyzeExamStructure", {
      schoolId: input.schoolId,
      examId: input.examId,
      assetCount: input.assetRefs.length,
      model: this.config.examStructureModel,
    });
    return { questions: [] };
  }

  async scoreSubmission(
    input: ScoreSubmissionInput,
  ): Promise<ScoreSubmissionResult> {
    // TODO(knife-1): Multimodal score vs known questions via this.chat (scoringModel).
    // TODO(knife-1): Persist via QuestionScore rows in the analysis worker.
    console.info("[llm/openrouter] stub scoreSubmission", {
      schoolId: input.schoolId,
      examId: input.examId,
      submissionId: input.submissionId,
      questionCount: input.questions.length,
      model: this.config.scoringModel,
    });
    return { scores: [] };
  }
}

/** Factory used by jobs/workers — always OpenRouter for MVP. */
export function createLlmClient(
  config: OpenRouterClientConfig = loadOpenRouterConfigFromEnv(),
): LlmClient {
  return new OpenRouterLlmClient(config);
}
