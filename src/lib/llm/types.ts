import type { FlatStructureQuestion } from "@/lib/exams/structure-questions";

/**
 * Multimodal LLM client contract for MarkInsight.
 *
 * Product lock: MVP scoring/analysis goes through **OpenRouter** only
 * (OpenAI-compatible Chat Completions API at https://openrouter.ai/api/v1).
 *
 * TODO(knife-1): Implement real HTTP calls (fetch/openai SDK) — no live calls in scaffold.
 * TODO(knife-1): Structured outputs → QuestionScore (topic, itemType, score, maxScore).
 * TODO(optional): Jina for syllabus/PDF text extraction or embeddings — not on the critical path.
 */

export type LlmContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  /** OpenRouter / OpenAI-compatible PDF (and other file) attachment. */
  | {
      type: "file";
      file: { filename: string; file_data: string };
    };

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | LlmContentPart[];
};

export type LlmChatRequest = {
  /** OpenRouter model id, e.g. `google/gemini-2.5-flash` (placeholder until locked). */
  model: string;
  messages: LlmChatMessage[];
  temperature?: number;
  /** Hint for JSON object responses when the model supports it. */
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
};

export type LlmChatResponse = {
  content: string;
  /** Model id actually used (from request or provider response). Persist on AnalysisJob / result rows. */
  llmModel: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
};

/** Exam paper / answer-key structure extraction (multimodal). */
export type AnalyzeExamStructureInput = {
  schoolId: string;
  examId: string;
  /** Object-storage keys or signed URLs for question paper / answer key assets. */
  assetRefs: Array<{
    kind: string;
    storageKey: string;
    mimeType?: string | null;
    fileName?: string | null;
  }>;
  /** Allowlisted model id from SchoolSettings for this run. */
  modelOverride?: string;
  /** Admin-configured system prompt. Falls back to the built-in default when omitted. */
  systemPrompt?: string;
  /** Called as questions are recognised so the exam page can show live progress. */
  onProgress?: (update: StructureProgressUpdate) => void | Promise<void>;
};

export type StructureProgressUpdate = {
  stage: "reading" | "receiving" | "question" | "saving";
  completed: number;
  total: number;
  questionKey: string | null;
  partKeys: string[];
  note: string | null;
  /** True when a whole numbered question has been committed. */
  commit: boolean;
  /** When set, drop existing rows for these parent keys before appending questions. */
  replaceParentKeys?: string[];
  questions?: FlatStructureQuestion[];
};

export type AnalyzeExamStructureResult = {
  /** Model id used for this structure analysis — must be persisted (Exam.structureLlmModel + AnalysisJob.llmModel). */
  llmModel: string;
  questions: FlatStructureQuestion[];
  rawModelText?: string;
};

/** Per-submission scoring against known structure (multimodal). */
export type ScoreSubmissionInput = {
  schoolId: string;
  examId: string;
  submissionId: string;
  /** Student script asset ref(s). */
  assetRefs: Array<{ kind: string; storageKey: string; mimeType?: string | null }>;
  /** Expected items from prior exam-structure analysis. */
  questions: AnalyzeExamStructureResult["questions"];
  /** Allowlisted model id from SchoolSettings for this run. */
  modelOverride?: string;
  /** Admin-configured system prompt. Falls back to the built-in default when omitted. */
  systemPrompt?: string;
};

export type ScoreSubmissionResult = {
  /** Model id used for this scoring — must be persisted (Submission.scoringLlmModel + AnalysisJob.llmModel). */
  llmModel: string;
  scores: Array<{
    questionKey: string;
    topic: string;
    itemType: string;
    score: number;
    maxScore: number;
    feedback?: string;
  }>;
  rawModelText?: string;
};

/**
 * Provider-agnostic interface; MVP implementation MUST target OpenRouter.
 */
export interface LlmClient {
  /** Low-level chat/completions (OpenAI-compatible). */
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;

  /** High-level: derive exam question structure + tags. */
  analyzeExamStructure(
    input: AnalyzeExamStructureInput,
  ): Promise<AnalyzeExamStructureResult>;

  /** High-level: score one student submission. */
  scoreSubmission(input: ScoreSubmissionInput): Promise<ScoreSubmissionResult>;
}
