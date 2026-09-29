import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDemoStudyReport,
  clampQuestionScore,
  clampScoreRatio,
  parseSubmissionScorePayload,
} from "./study-report.ts";

const questions = [
  {
    questionKey: "1(a)",
    topic: "代數",
    itemType: "計算",
    maxScore: 4,
    topicZh: "代數",
    topicEn: "algebra",
    assessmentObjectiveZh: "考核移項。",
    assessmentObjectiveEn: "Tests rearranging terms.",
    difficultyPointsZh: "符號容易寫錯。",
    difficultyPointsEn: "The sign is easy to flip.",
  },
  {
    questionKey: "2",
    topic: "幾何",
    itemType: "短答",
    maxScore: 3,
  },
];

test("reads bilingual study sections and an overall revision focus", () => {
  const parsed = parseSubmissionScorePayload(
    {
      studyFocus: {
        zh: "先重做第 1(a) 題的移項。",
        en: "Redo the rearranging in 1(a) first.",
      },
      scores: [
        {
          questionKey: "1(a)",
          score: 2,
          maxScore: 4,
          feedback: "只得一半分。",
          didWell: { zh: "開首移項方向正確。", en: "The first rearrangement is right." },
          weakness: { zh: "沒有代回原式檢驗。", en: "The value was not substituted back." },
          mistakesToWatch: [
            { zh: "移項時正負號寫反。", en: "The sign flips when a term moves." },
            { zh: "漏寫單位。", en: "The unit is missing." },
          ],
          howToImprove: {
            zh: "只重寫檢驗一步。\n第二天不看筆記再做。",
            en: "Rewrite only the check.\nRedo it the next day without notes.",
          },
        },
      ],
    },
    questions,
  );

  assert.equal(parsed.studyFocusZh, "先重做第 1(a) 題的移項。");
  assert.equal(parsed.studyFocusEn, "Redo the rearranging in 1(a) first.");
  assert.equal(parsed.scores.length, 1);
  assert.equal(parsed.scores[0].score, 2);
  assert.equal(parsed.scores[0].didWellZh, "開首移項方向正確。");
  assert.equal(parsed.scores[0].didWellEn, "The first rearrangement is right.");
  assert.match(parsed.scores[0].mistakesToWatchZh, /正負號/);
  assert.match(parsed.scores[0].mistakesToWatchZh, /單位/);
  assert.match(parsed.scores[0].howToImproveEn, /without notes/);
  assert.equal(parsed.scores[0].feedback, "只得一半分。");
});

test("accepts paired language keys and keeps a legacy feedback-only score", () => {
  const parsed = parseSubmissionScorePayload(
    {
      revisionPlanZh: "先看第 2 題。",
      revisionPlanEn: "Start with question 2.",
      scores: [
        {
          questionKey: "2",
          topic: "幾何",
          itemType: "短答",
          score: 3,
          maxScore: 3,
          feedback: "Clear working.",
          didWellZh: "底角相等寫對了。",
          didWellEn: "The base angles are correct.",
        },
        {
          questionKey: "9",
          score: 1,
          feedback: "not on this paper",
        },
      ],
    },
    questions,
  );

  assert.equal(parsed.studyFocusZh, "先看第 2 題。");
  assert.equal(parsed.scores.length, 1);
  assert.equal(parsed.scores[0].didWellEn, "The base angles are correct.");
  assert.equal(parsed.scores[0].weaknessZh, "");
  assert.equal(parsed.scores[0].feedback, "Clear working.");
});

test("puts a single-language string on the matching side", () => {
  const parsed = parseSubmissionScorePayload(
    {
      scores: [
        {
          questionKey: "1(a)",
          score: 0,
          weakness: "未寫出方程。",
          mistakesToWatch: "Do not skip the equation.",
        },
      ],
    },
    questions,
  );

  assert.equal(parsed.scores[0].weaknessZh, "未寫出方程。");
  assert.equal(parsed.scores[0].weaknessEn, "");
  assert.equal(parsed.scores[0].mistakesToWatchEn, "Do not skip the equation.");
  assert.equal(parsed.scores[0].mistakesToWatchZh, "");
});

test("demo report covers every question in both languages", () => {
  const report = buildDemoStudyReport(questions);
  assert.equal(report.scores.length, 2);
  assert.match(report.studyFocusZh, /溫習次序/);
  assert.match(report.studyFocusEn, /Revise in this order/);
  for (const row of report.scores) {
    assert.ok(row.didWellZh.length > 0);
    assert.ok(row.didWellEn.length > 0);
    assert.ok(row.weaknessZh.length > 0);
    assert.ok(row.weaknessEn.length > 0);
    assert.ok(row.mistakesToWatchZh.length > 0);
    assert.ok(row.mistakesToWatchEn.length > 0);
    assert.ok(row.howToImproveZh.includes("\n"));
    assert.ok(row.howToImproveEn.includes("\n"));
  }
});

test("clamps each question score to 0..maxScore and overall ratio to 0..1", () => {
  assert.equal(clampQuestionScore(-3, 4), 0);
  assert.equal(clampQuestionScore(9, 4), 4);
  assert.equal(clampQuestionScore(2.5, 4), 2.5);
  assert.equal(clampScoreRatio(50, 40), 1);
  assert.equal(clampScoreRatio(-1, 40), 0);
  assert.equal(clampScoreRatio(20, 40), 0.5);

  const parsed = parseSubmissionScorePayload(
    {
      scores: [
        { questionKey: "1(a)", score: -2, maxScore: 99 },
        { questionKey: "2", score: 99, maxScore: 1 },
      ],
    },
    questions,
  );
  assert.equal(parsed.scores[0].score, 0);
  assert.equal(parsed.scores[0].maxScore, 4);
  assert.equal(parsed.scores[1].score, 3);
  assert.equal(parsed.scores[1].maxScore, 3);
  const totalScore = parsed.scores.reduce((sum, row) => sum + row.score, 0);
  const totalMax = parsed.scores.reduce((sum, row) => sum + row.maxScore, 0);
  const pct = clampScoreRatio(totalScore, totalMax) * 100;
  assert.ok(pct >= 0 && pct <= 100);
});
