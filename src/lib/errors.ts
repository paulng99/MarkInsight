/**
 * Vendor-neutral API / job errors for product surfaces.
 * Never leak supplier brand names (OpenRouter, Jina, OpenAI, Google, …).
 */

const VENDOR_PATTERNS =
  /\b(openrouter|jina|openai|anthropic|google|gemini|claude|gpt-4|fal\.ai|fal ai)\b/gi;

/** Strip vendor brand tokens from any message before returning to the UI. */
export function sanitizeVendorLeak(message: string): string {
  return message
    .replace(VENDOR_PATTERNS, "analysis service")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "app_error") {
    super(sanitizeVendorLeak(message));
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function jsonError(
  error: unknown,
  fallback = "Something went wrong.",
  fallbackStatus = 500,
): { body: { error: string; code?: string }; status: number } {
  if (error instanceof AppError) {
    return {
      body: { error: error.message, code: error.code },
      status: error.status,
    };
  }
  if (error instanceof Error && error.message) {
    return {
      body: { error: sanitizeVendorLeak(error.message) },
      status: fallbackStatus,
    };
  }
  return { body: { error: fallback }, status: fallbackStatus };
}

/** HK-friendly upload hint — only when the file itself is corrupt or unreadable. */
export const UPLOAD_CHECK_FILE_ZH = "請檢查檔案";

export const UPLOAD_FAILED_ZH = "上載失敗。";

/** Keep in sync with STRUCTURE_NOT_READY_MESSAGE in structure-ready.ts (user-facing). */
export const UPLOAD_STRUCTURE_NOT_READY_ZH =
  "老師尚未完成試卷設定，暫時無法上載，請稍後再試。若長時間仍無法上載，請通知老師。";

export const ANALYSIS_NOT_CONFIGURED =
  "分析服務尚未設定，請聯絡管理員。";

export const ANALYSIS_FAILED_GENERIC =
  "分析失敗。請稍後再試。";

export const ANALYSIS_BUSY =
  "分析服務繁忙，請稍候再試。";

export const ANALYSIS_UNSUPPORTED_FILE =
  "分析失敗。檔案格式可能不受支援，請上載 PDF、JPG 或 PNG。";

/** Error codes where the UI may show「請檢查檔案」as a secondary hint. */
export const FILE_CHECK_ERROR_CODES = new Set([
  "empty_upload",
  "file_unreadable",
  "file_not_found",
  "corrupt_file",
]);
