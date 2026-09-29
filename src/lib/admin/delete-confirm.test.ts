import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
  deleteHasProtectedData,
  evaluateDeleteConfirmation,
  evaluateDeleteImpactFreshness,
  fillDeleteImpactTemplate,
  matchesDeleteConfirmText,
  sumClassImpact,
  sumClassesImpact,
} from "./delete-confirm.ts";

test("matchesDeleteConfirmText requires an exact trimmed match", () => {
  assert.equal(matchesDeleteConfirmText("MATH", "MATH"), true);
  assert.equal(matchesDeleteConfirmText("  MATH  ", "MATH"), true);
  assert.equal(matchesDeleteConfirmText("math", "MATH"), false);
  assert.equal(matchesDeleteConfirmText("MATH ", "MATHX"), false);
  assert.equal(matchesDeleteConfirmText("", "刪除"), false);
  assert.equal(matchesDeleteConfirmText("刪除", "刪除"), true);
  assert.equal(matchesDeleteConfirmText(" DELETE ", "DELETE"), true);
});

test("fillDeleteImpactTemplate replaces known placeholders", () => {
  const out = fillDeleteImpactTemplate(
    "此科目下有 {exams} 份試卷與分析結果，刪除後無法復原。建議改用封存。",
    { exams: 12, classes: 3 },
  );
  assert.equal(
    out,
    "此科目下有 12 份試卷與分析結果，刪除後無法復原。建議改用封存。",
  );
  assert.equal(
    fillDeleteImpactTemplate("Type {token} to confirm", { token: "3A" }),
    "Type 3A to confirm",
  );
  assert.equal(
    fillDeleteImpactTemplate("missing {unknown}", {}),
    "missing ",
  );
});

test("sumClassImpact and sumClassesImpact aggregate server counts", () => {
  assert.deepEqual(
    sumClassImpact({ enrollmentCount: 28, examCount: 4, submissionCount: 90 }),
    { classes: 1, enrollments: 28, exams: 4, submissions: 90 },
  );
  assert.deepEqual(
    sumClassesImpact([
      { enrollmentCount: 10, examCount: 2, submissionCount: 20 },
      { enrollmentCount: 5, examCount: 1, submissionCount: 8 },
    ]),
    { classes: 2, enrollments: 15, exams: 3, submissions: 28 },
  );
  assert.deepEqual(sumClassesImpact([]), {
    classes: 0,
    enrollments: 0,
    exams: 0,
    submissions: 0,
  });
});

test("deleteHasProtectedData detects exams, submissions, or analysis jobs", () => {
  assert.equal(deleteHasProtectedData({ submissionCount: 0 }), false);
  assert.equal(
    deleteHasProtectedData({ submissionCount: 0, analysisJobCount: 0 }),
    false,
  );
  assert.equal(deleteHasProtectedData({ submissionCount: 1 }), true);
  assert.equal(
    deleteHasProtectedData({ submissionCount: 0, analysisJobCount: 2 }),
    true,
  );
  assert.equal(
    deleteHasProtectedData({ submissionCount: 0, examCount: 1 }),
    true,
  );
});

test("evaluateDeleteConfirmation rejects with opaque copy when protected", () => {
  assert.deepEqual(
    evaluateDeleteConfirmation({
      confirm: undefined,
      expectedToken: "MATH",
      hasProtectedData: false,
    }),
    { ok: true },
  );

  const missing = evaluateDeleteConfirmation({
    confirm: undefined,
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(missing, {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.doesNotMatch(missing.error, /school/i);
    assert.doesNotMatch(missing.error, /MATH/);
  }

  const wrong = evaluateDeleteConfirmation({
    confirm: "ENG",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.equal(wrong.ok, false);
  if (!wrong.ok) {
    assert.equal(wrong.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  }

  assert.deepEqual(
    evaluateDeleteConfirmation({
      confirm: "  MATH  ",
      expectedToken: "MATH",
      hasProtectedData: true,
    }),
    { ok: true },
  );
});

test("evaluateDeleteImpactFreshness rejects when exams or submissions change", () => {
  assert.deepEqual(
    evaluateDeleteImpactFreshness({
      expectedExams: 0,
      expectedSubmissions: 0,
      actualExams: 0,
      actualSubmissions: 0,
    }),
    { ok: true },
  );

  const addedExam = evaluateDeleteImpactFreshness({
    expectedExams: 0,
    expectedSubmissions: 0,
    actualExams: 1,
    actualSubmissions: 0,
  });
  assert.deepEqual(addedExam, {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  });

  const missingExpected = evaluateDeleteImpactFreshness({
    expectedExams: undefined,
    expectedSubmissions: undefined,
    actualExams: 2,
    actualSubmissions: 0,
  });
  assert.equal(missingExpected.ok, false);

  assert.deepEqual(
    evaluateDeleteImpactFreshness({
      expectedExams: 3,
      expectedSubmissions: 10,
      actualExams: 3,
      actualSubmissions: 10,
    }),
    { ok: true },
  );
});
