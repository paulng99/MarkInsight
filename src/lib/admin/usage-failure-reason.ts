import type { AnalysisJobStatus } from "@prisma/client";

/** Older jobs stored these English sentences before the product copy was Chinese. */
const LEGACY_FAILURE_ZH: Record<string, string> = {
  "Exam structure analysis has not completed yet.":
    "試卷結構分析尚未完成，因此未能評分。",
  "Analysis failed. The file format may not be supported by the selected model. Try PDF via a vision-capable model, or upload JPEG/PNG.":
    "分析失敗。所選模型可能不支援此檔案格式。請改用可讀 PDF 的視覺模型，或上載 JPEG／PNG。",
  "Analysis failed. Please check the file and try again.":
    "分析失敗。請檢查檔案後再試。",
};

/** Stored failure text for the usage table. Other statuses never show a reason. */
export function usageFailureReason(
  status: AnalysisJobStatus,
  errorMessage: string | null | undefined,
  locale: "en" | "zh-HK" = "en",
): string | null {
  if (status !== "FAILED") return null;
  const text = errorMessage?.trim() ?? "";
  if (!text) return null;
  if (locale === "zh-HK") return LEGACY_FAILURE_ZH[text] ?? text;
  return text;
}
