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

/** HK-friendly upload hint (also used in en as secondary copy via i18n). */
export const UPLOAD_CHECK_FILE_ZH = "請檢查檔案";

export const ANALYSIS_NOT_CONFIGURED =
  "Analysis service is not configured. Please contact your administrator.";

export const ANALYSIS_FAILED_GENERIC =
  "Analysis failed. Please check the file and try again.";

export const ANALYSIS_BUSY =
  "分析服務繁忙，請稍候再試。";

export const ANALYSIS_UNSUPPORTED_FILE =
  "分析失敗。檔案格式可能不受支援，請上載 PDF、JPEG 或 PNG。";
