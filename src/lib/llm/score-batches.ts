/** One numbered question and every part that belongs to it. */
export type ScoreBatch<T extends { parentKey: string; questionKey: string }> = {
  parentKey: string;
  questions: T[];
};

/**
 * Split a flat structure list into one batch per numbered question.
 * Scoring the whole paper in a single model call exceeds the request
 * timeout before any score is returned.
 */
export function batchQuestionsByParent<T extends { parentKey: string; questionKey: string }>(
  questions: T[],
): ScoreBatch<T>[] {
  const batches: ScoreBatch<T>[] = [];
  for (const question of questions) {
    const parentKey = question.parentKey.trim() || question.questionKey;
    const last = batches[batches.length - 1];
    if (last && last.parentKey === parentKey) {
      last.questions.push(question);
      continue;
    }
    batches.push({ parentKey, questions: [question] });
  }
  return batches;
}
