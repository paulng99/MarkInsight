import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE_CONFIRM_REQUIRED_CODE,
  DELETE_CONFIRM_REQUIRED_MESSAGE,
  deleteHasProtectedData,
  evaluateDeleteConfirmation,
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

test("deleteHasProtectedData detects submissions or analysis jobs", () => {
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
});

test("evaluateDeleteConfirmation rejects missing or wrong confirm when protected", () => {
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
    error: DELETE_CONFIRM_REQUIRED_MESSAGE,
    code: DELETE_CONFIRM_REQUIRED_CODE,
  });

  const wrong = evaluateDeleteConfirmation({
    confirm: "ENG",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.equal(wrong.ok, false);

  const ok = evaluateDeleteConfirmation({
    confirm: "  MATH  ",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(ok, { ok: true });

  assert.deepEqual(
    evaluateDeleteConfirmation({
      confirm: "3A",
      expectedToken: "3A",
      hasProtectedData: true,
    }),
    { ok: true },
  );
});
