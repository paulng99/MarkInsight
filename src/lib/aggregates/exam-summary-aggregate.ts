/**
 * Pure class-wide single-exam score aggregation (no I/O).
 */

export type QuestionScoreInput = {
  questionKey: string;
  topic: string;
  score: number;
  maxScore: number;
};

export type ClassQuestionAggregate = {
  questionKey: string;
  topic: string;
  avgScoreRatio: number;
  attemptCount: number;
};

export type ClassTopicAggregate = {
  topic: string;
  avgScoreRatio: number;
  attemptCount: number;
};

function ratio(score: number, maxScore: number) {
  return maxScore > 0 ? score / maxScore : 0;
}

function pickTopic(topicCounts: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [topic, count] of topicCounts) {
    if (
      count > bestCount ||
      (count === bestCount && topic.localeCompare(best) < 0)
    ) {
      best = topic;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Aggregate per-question and per-topic averages across succeeded submissions.
 * Missing questionKeys on a submission are skipped (not treated as zero).
 * Rows with maxScore <= 0 are skipped entirely (e.g. 0/0 must not appear as 0%).
 * Ties on average are broken by questionKey / topic ascending.
 */
export function aggregateClassExamScores(
  submissions: Array<{ scores: QuestionScoreInput[] }>,
): {
  questions: ClassQuestionAggregate[];
  topics: ClassTopicAggregate[];
  weakestThree: ClassQuestionAggregate[];
} {
  const questionMap = new Map<
    string,
    { sum: number; count: number; topicCounts: Map<string, number> }
  >();
  const topicMap = new Map<string, { sum: number; count: number }>();

  for (const sub of submissions) {
    for (const s of sub.scores) {
      if (s.maxScore <= 0) continue;
      const r = ratio(s.score, s.maxScore);
      const q = questionMap.get(s.questionKey) ?? {
        sum: 0,
        count: 0,
        topicCounts: new Map<string, number>(),
      };
      q.sum += r;
      q.count += 1;
      q.topicCounts.set(s.topic, (q.topicCounts.get(s.topic) ?? 0) + 1);
      questionMap.set(s.questionKey, q);

      const t = topicMap.get(s.topic) ?? { sum: 0, count: 0 };
      t.sum += r;
      t.count += 1;
      topicMap.set(s.topic, t);
    }
  }

  const questions: ClassQuestionAggregate[] = [...questionMap.entries()]
    .map(([questionKey, q]) => ({
      questionKey,
      topic: pickTopic(q.topicCounts),
      avgScoreRatio: q.count ? q.sum / q.count : 0,
      attemptCount: q.count,
    }))
    .sort(
      (a, b) =>
        a.avgScoreRatio - b.avgScoreRatio ||
        a.questionKey.localeCompare(b.questionKey),
    );

  const topics: ClassTopicAggregate[] = [...topicMap.entries()]
    .map(([topic, t]) => ({
      topic,
      avgScoreRatio: t.count ? t.sum / t.count : 0,
      attemptCount: t.count,
    }))
    .sort(
      (a, b) =>
        a.avgScoreRatio - b.avgScoreRatio || a.topic.localeCompare(b.topic),
    );

  return {
    questions,
    topics,
    weakestThree: questions.slice(0, 3),
  };
}
