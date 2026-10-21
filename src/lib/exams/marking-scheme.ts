/**
 * Official answer and mark scheme copied from the uploaded answer key.
 * Scoring must use these texts. It must not award marks from its own judgement.
 */

export type MarkingGuide = {
  questionKey: string;
  modelAnswer: string;
  markingCriteria: string;
};

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readItem(value: unknown): MarkingGuide | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const questionKey = textOf(record.questionKey || record.key);
  const modelAnswer = textOf(
    record.modelAnswer || record.officialAnswer || record.answer || record.expectedAnswer,
  );
  const markingCriteria = textOf(
    record.markingCriteria ||
      record.markingScheme ||
      record.markScheme ||
      record.criteria ||
      record.marks,
  );
  if (!questionKey || !markingCriteria) return null;
  return { questionKey, modelAnswer, markingCriteria };
}

/** Pull per-part guides out of a model JSON object. Blank criteria are dropped. */
export function parseMarkingGuidePayload(payload: unknown): MarkingGuide[] {
  const root =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const raw = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.questions)
      ? root.questions
      : Array.isArray(payload)
        ? payload
        : [];
  const guides: MarkingGuide[] = [];
  for (const item of raw) {
    const guide = readItem(item);
    if (guide) guides.push(guide);
  }
  return guides;
}

export type UploadedQuestionForScoring = {
  questionKey: string;
  stem: string;
  prompt: string;
  maxScore: number;
  modelAnswer: string;
  markingCriteria: string;
};

/**
 * Question wording from the uploaded paper, plus the answer and mark scheme
 * copied from the uploaded answer key.
 */
export function formatUploadedMarkingBlock(question: UploadedQuestionForScoring): string | null {
  const criteria = question.markingCriteria.trim();
  if (!criteria) return null;
  const wording = [question.stem.trim(), question.prompt.trim()].filter(Boolean).join("\n");
  const answer = question.modelAnswer.trim() || "（見評分標準）";
  return [
    `questionKey: ${question.questionKey}`,
    `maxScore: ${question.maxScore}`,
    `Uploaded question:\n${wording}`,
    `Official answer from the uploaded answer key:\n${answer}`,
    `Marking criteria from the uploaded answer key:\n${criteria}`,
  ].join("\n");
}
