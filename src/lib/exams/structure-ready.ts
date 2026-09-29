/**
 * Whether students may upload scripts: teacher finished structure analysis.
 */

export const STRUCTURE_NOT_READY_MESSAGE =
  "老師尚未完成試卷設定，暫時無法上載，請稍後再試。";

/** Pure gate used by upload APIs and unit tests. */
export function isExamStructureReady(input: {
  structureLlmModel: string | null | undefined;
  questionCount: number;
}): boolean {
  if (input.questionCount > 0) return true;
  return Boolean(input.structureLlmModel?.trim());
}
