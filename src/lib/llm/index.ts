/**
 * LLM module entry — MVP provider is OpenRouter (required).
 *
 * Optional Jina (JINA_API_KEY) may later support syllabus/PDF text extraction
 * or embeddings; v1 scoring stays OpenRouter multimodal. See docs/architecture.md.
 */

export type {
  AnalyzeExamStructureInput,
  AnalyzeExamStructureResult,
  LlmChatMessage,
  LlmChatRequest,
  LlmChatResponse,
  LlmClient,
  LlmContentPart,
  ScoreSubmissionInput,
  ScoreSubmissionResult,
} from "@/lib/llm/types";

export {
  createLlmClient,
  loadOpenRouterConfigFromEnv,
  OpenRouterLlmClient,
  type OpenRouterClientConfig,
} from "@/lib/llm/openrouter";
