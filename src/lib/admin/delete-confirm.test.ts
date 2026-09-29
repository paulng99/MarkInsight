import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
  deleteHasProtectedData,
  evaluateBulkDeleteArchivedGuards,
  evaluateDeleteConfirmation,
  evaluateDeleteImpactFreshness,
  evaluateRequiredExpectedCounts,
  fillDeleteImpactTemplate,
  matchesDeleteConfirmText,
  sumClassImpact,
  sumClassesImpact,
} from "./delete-confirm.ts";

test("matchesDeleteConfirmText requires an exact trimmed match", () => {
  assert.equal(matchesDeleteConfirmText("MATH", "MATH"), true);
  assert.equal(matchesDeleteConfirmText("  MATH  ", "MATH"), true);
  assert.equal(matchesDeleteConfirmText("math", "MATH"), false);
  assert.equal(matchesDeleteConfirmText("刪除", "刪除"), true);
});

test("sumClassImpact and sumClassesImpact include analysisJobs", () => {
  assert.deepEqual(
    sumClassImpact({
      enrollmentCount: 28,
      examCount: 4,
      submissionCount: 90,
      analysisJobCount: 7,
    }),
    {
      classes: 1,
      enrollments: 28,
      exams: 4,
      submissions: 90,
      analysisJobs: 7,
    },
  );
  assert.deepEqual(
    sumClassesImpact([
      {
        enrollmentCount: 10,
        examCount: 2,
        submissionCount: 20,
        analysisJobCount: 1,
      },
      {
        enrollmentCount: 5,
        examCount: 1,
        submissionCount: 8,
        analysisJobCount: 3,
      },
    ]),
    {
      classes: 2,
      enrollments: 15,
      exams: 3,
      submissions: 28,
      analysisJobs: 4,
    },
  );
});

test("deleteHasProtectedData detects exams, submissions, or analysis jobs", () => {
  assert.equal(deleteHasProtectedData({ submissionCount: 0 }), false);
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

test("evaluateRequiredExpectedCounts rejects omitted fields", () => {
  assert.deepEqual(
    evaluateRequiredExpectedCounts({
      expectedExams: 0,
      expectedSubmissions: 0,
      expectedAnalysisJobs: 0,
    }),
    { ok: true },
  );
  assert.equal(
    evaluateRequiredExpectedCounts({
      expectedExams: undefined,
      expectedSubmissions: 0,
      expectedAnalysisJobs: 0,
    }).ok,
    false,
  );
  assert.equal(
    evaluateRequiredExpectedCounts({
      expectedExams: 0,
      expectedSubmissions: 0,
      expectedAnalysisJobs: 0,
      requireClasses: true,
    }).ok,
    false,
  );
});

test("evaluateDeleteConfirmation rejects with opaque copy when protected", () => {
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

  const wrong = evaluateDeleteConfirmation({
    confirm: "ENG",
    expectedToken: "MATH",
    hasProtectedData: true,
  });
  assert.deepEqual(wrong, {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  });

  assert.deepEqual(
    evaluateDeleteConfirmation({
      confirm: "  MATH  ",
      expectedToken: "MATH",
      hasProtectedData: true,
    }),
    { ok: true },
  );
});

test("evaluateDeleteImpactFreshness rejects omitted or stale counts", () => {
  assert.deepEqual(
    evaluateDeleteImpactFreshness({
      expectedExams: 0,
      expectedSubmissions: 0,
      expectedAnalysisJobs: 0,
      actualExams: 0,
      actualSubmissions: 0,
      actualAnalysisJobs: 0,
    }),
    { ok: true },
  );

  assert.equal(
    evaluateDeleteImpactFreshness({
      expectedExams: undefined,
      expectedSubmissions: 0,
      expectedAnalysisJobs: 0,
      actualExams: 0,
      actualSubmissions: 0,
      actualAnalysisJobs: 0,
    }).ok,
    false,
  );

  const addedExam = evaluateDeleteImpactFreshness({
    expectedExams: 0,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
    actualExams: 1,
    actualSubmissions: 0,
    actualAnalysisJobs: 0,
  });
  assert.deepEqual(addedExam, {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  });

  const addedSubmission = evaluateDeleteImpactFreshness({
    expectedExams: 1,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
    actualExams: 1,
    actualSubmissions: 2,
    actualAnalysisJobs: 0,
  });
  assert.deepEqual(addedSubmission, {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  });

  const staleJobs = evaluateDeleteImpactFreshness({
    expectedExams: 1,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
    actualExams: 1,
    actualSubmissions: 0,
    actualAnalysisJobs: 2,
  });
  assert.deepEqual(staleJobs, {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  });
});

test("evaluateBulkDeleteArchivedGuards requires 刪除 and all expected counts", () => {
  assert.equal(ADMIN_BULK_DELETE_ARCHIVED_CONFIRM, "刪除");

  assert.equal(
    evaluateBulkDeleteArchivedGuards({
      confirm: "刪除",
      expectedClasses: 2,
      expectedExams: 1,
      expectedSubmissions: 0,
      expectedAnalysisJobs: undefined,
      actualClasses: 2,
      actualExams: 1,
      actualSubmissions: 0,
      actualAnalysisJobs: 0,
    }).ok,
    false,
  );

  assert.deepEqual(
    evaluateBulkDeleteArchivedGuards({
      confirm: " 刪除 ",
      expectedClasses: 2,
      expectedExams: 1,
      expectedSubmissions: 4,
      expectedAnalysisJobs: 3,
      actualClasses: 2,
      actualExams: 1,
      actualSubmissions: 4,
      actualAnalysisJobs: 3,
    }),
    { ok: true },
  );
});

test("fillDeleteImpactTemplate replaces known placeholders", () => {
  assert.equal(
    fillDeleteImpactTemplate("班別學生名單（{enrollments} 人）將一併刪除。", {
      enrollments: 0,
    }),
    "班別學生名單（0 人）將一併刪除。",
  );
});
