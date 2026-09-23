#!/usr/bin/env node
/**
 * Offline smoke for cross-exam weakness aggregation math (no DB / server).
 * Mirrors src/lib/aggregates/weakness.ts bucket rules.
 */

function aggregate(scores) {
  const topicMap = new Map();
  const typeMap = new Map();
  const examIds = new Set();
  for (const s of scores) {
    examIds.add(s.examId);
    const r = s.maxScore > 0 ? s.score / s.maxScore : 0;
    const t = topicMap.get(s.topic) ?? { sum: 0, count: 0, exams: new Set() };
    t.sum += r;
    t.count += 1;
    t.exams.add(s.examId);
    topicMap.set(s.topic, t);
    const it = typeMap.get(s.itemType) ?? { sum: 0, count: 0, exams: new Set() };
    it.sum += r;
    it.count += 1;
    it.exams.add(s.examId);
    typeMap.set(s.itemType, it);
  }
  const byTopic = [...topicMap.entries()].map(([topic, v]) => ({
    topic,
    avgScoreRatio: v.sum / v.count,
    examCount: v.exams.size,
  }));
  byTopic.sort((a, b) => a.avgScoreRatio - b.avgScoreRatio);
  return {
    succeededExamCount: examIds.size,
    ready: examIds.size >= 2,
    byTopic,
    byItemType: [...typeMap.entries()].map(([itemType, v]) => ({
      itemType,
      avgScoreRatio: v.sum / v.count,
      examCount: v.exams.size,
    })),
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const oneExam = aggregate([
  { examId: "e1", topic: "algebra", itemType: "mcq", score: 2, maxScore: 4 },
]);
assert(!oneExam.ready, "1 exam → empty / not ready");
assert(oneExam.succeededExamCount === 1, "count 1");

const two = aggregate([
  { examId: "e1", topic: "algebra", itemType: "mcq", score: 1, maxScore: 4 },
  { examId: "e1", topic: "geometry", itemType: "short", score: 4, maxScore: 4 },
  { examId: "e2", topic: "algebra", itemType: "mcq", score: 2, maxScore: 4 },
  { examId: "e2", topic: "geometry", itemType: "short", score: 3, maxScore: 4 },
]);
assert(two.ready, "2 exams → ready");
assert(two.succeededExamCount === 2, "count 2");
assert(two.byTopic[0].topic === "algebra", "weaker topic first (algebra)");
assert(two.byTopic[0].avgScoreRatio < two.byTopic[1].avgScoreRatio, "sorted by weakness");

console.log("smoke-weakness-agg: ok");
