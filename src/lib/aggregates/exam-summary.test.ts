import assert from "node:assert/strict";
import test from "node:test";
import { aggregateClassExamScores } from "./exam-summary-aggregate.ts";

test("weakest three ordered by average then questionKey", () => {
  const result = aggregateClassExamScores([
    {
      scores: [
        { questionKey: "Q2", topic: "Algebra", score: 1, maxScore: 10 },
        { questionKey: "Q1", topic: "Geometry", score: 5, maxScore: 10 },
        { questionKey: "Q3", topic: "Stats", score: 8, maxScore: 10 },
        { questionKey: "Q4", topic: "Calc", score: 2, maxScore: 10 },
      ],
    },
    {
      scores: [
        { questionKey: "Q2", topic: "Algebra", score: 0, maxScore: 10 },
        { questionKey: "Q1", topic: "Geometry", score: 5, maxScore: 10 },
        { questionKey: "Q3", topic: "Stats", score: 9, maxScore: 10 },
        { questionKey: "Q4", topic: "Calc", score: 2, maxScore: 10 },
      ],
    },
  ]);

  assert.deepEqual(
    result.weakestThree.map((q) => q.questionKey),
    ["Q2", "Q4", "Q1"],
  );
  assert.equal(result.weakestThree[0].avgScoreRatio, 0.05);
  assert.equal(result.weakestThree[0].topic, "Algebra");
  assert.equal(result.weakestThree[1].avgScoreRatio, 0.2);
  assert.equal(result.weakestThree[2].avgScoreRatio, 0.5);
});

test("ties on average broken by questionKey ascending", () => {
  const result = aggregateClassExamScores([
    {
      scores: [
        { questionKey: "Qb", topic: "T", score: 4, maxScore: 10 },
        { questionKey: "Qa", topic: "T", score: 4, maxScore: 10 },
        { questionKey: "Qc", topic: "T", score: 4, maxScore: 10 },
        { questionKey: "Qd", topic: "T", score: 9, maxScore: 10 },
      ],
    },
  ]);

  assert.deepEqual(
    result.weakestThree.map((q) => q.questionKey),
    ["Qa", "Qb", "Qc"],
  );
  assert.ok(result.weakestThree.every((q) => q.avgScoreRatio === 0.4));
});

test("missing questions are skipped per submission, not zero-filled", () => {
  const result = aggregateClassExamScores([
    {
      scores: [
        { questionKey: "Q1", topic: "A", score: 10, maxScore: 10 },
        { questionKey: "Q2", topic: "B", score: 0, maxScore: 10 },
      ],
    },
    {
      scores: [
        // Q2 missing on this script
        { questionKey: "Q1", topic: "A", score: 0, maxScore: 10 },
      ],
    },
  ]);

  const q1 = result.questions.find((q) => q.questionKey === "Q1");
  const q2 = result.questions.find((q) => q.questionKey === "Q2");
  assert.ok(q1);
  assert.ok(q2);
  assert.equal(q1.attemptCount, 2);
  assert.equal(q1.avgScoreRatio, 0.5);
  assert.equal(q2.attemptCount, 1);
  assert.equal(q2.avgScoreRatio, 0);
  assert.equal(result.weakestThree[0].questionKey, "Q2");
});

test("partial uploads: averages only over submissions present", () => {
  // One strong script + one weak — class average is mean of those two only.
  const result = aggregateClassExamScores([
    {
      scores: [{ questionKey: "Q1", topic: "Algebra", score: 10, maxScore: 10 }],
    },
    {
      scores: [{ questionKey: "Q1", topic: "Algebra", score: 0, maxScore: 10 }],
    },
  ]);

  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].avgScoreRatio, 0.5);
  assert.equal(result.questions[0].attemptCount, 2);
  assert.equal(result.topics[0].topic, "Algebra");
  assert.equal(result.topics[0].avgScoreRatio, 0.5);
});

test("zero uploads yields empty aggregates", () => {
  const result = aggregateClassExamScores([]);
  assert.deepEqual(result.questions, []);
  assert.deepEqual(result.topics, []);
  assert.deepEqual(result.weakestThree, []);
});

test("topic for a question uses majority vote with topic-name tie-break", () => {
  const result = aggregateClassExamScores([
    {
      scores: [{ questionKey: "Q1", topic: "Beta", score: 5, maxScore: 10 }],
    },
    {
      scores: [{ questionKey: "Q1", topic: "Alpha", score: 5, maxScore: 10 }],
    },
  ]);
  assert.equal(result.questions[0].topic, "Alpha");
});
