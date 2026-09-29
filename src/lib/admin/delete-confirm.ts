/**
 * Pure helpers for admin delete typed-confirmation UX and server guards.
 */

export type DeleteImpactCounts = {
  classes: number;
  enrollments: number;
  exams: number;
  submissions: number;
  analysisJobs: number;
};

/** Opaque code for any failed admin subject/class delete. */
export const ADMIN_DELETE_REJECTED_CODE = "delete_rejected";

/**
 * Opaque English API copy — must not reveal cross-school existence,
 * confirm mismatch details, or whether a row was found.
 */
export const ADMIN_DELETE_REJECTED_MESSAGE_EN =
  "Could not delete: the data has changed or you do not have permission. Refresh the page and try again.";

/**
 * Fixed confirm token for bulk delete of archived classes.
 * Locale-independent — UI always asks for this exact string.
 */
export const ADMIN_BULK_DELETE_ARCHIVED_CONFIRM = "刪除";

/** @deprecated Use ADMIN_DELETE_REJECTED_CODE — kept as alias for older tests. */
export const DELETE_CONFIRM_REQUIRED_CODE = ADMIN_DELETE_REJECTED_CODE;

/** @deprecated Use ADMIN_DELETE_REJECTED_MESSAGE_EN */
export const DELETE_CONFIRM_REQUIRED_MESSAGE = ADMIN_DELETE_REJECTED_MESSAGE_EN;

/** Confirm is enabled only when the trimmed input equals the expected token exactly. */
export function matchesDeleteConfirmText(
  input: string,
  expected: string,
): boolean {
  return input.trim() === expected;
}

/** True when deleting would remove answer scripts, exams, or analysis results. */
export function deleteHasProtectedData(input: {
  submissionCount: number;
  analysisJobCount?: number;
  examCount?: number;
}): boolean {
  return (
    input.submissionCount > 0 ||
    (input.analysisJobCount ?? 0) > 0 ||
    (input.examCount ?? 0) > 0
  );
}

function rejected(): {
  ok: false;
  status: 400;
  error: string;
  code: string;
} {
  return {
    ok: false,
    status: 400,
    error: ADMIN_DELETE_REJECTED_MESSAGE_EN,
    code: ADMIN_DELETE_REJECTED_CODE,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Server-side delete confirmation.
 * When the target has exams / submissions / analysis results, `confirm` must
 * equal the expected token (subject code or class name).
 * Pass `requireConfirm: true` to always require a matching confirm (bulk delete).
 */
export function evaluateDeleteConfirmation(input: {
  confirm: unknown;
  expectedToken: string;
  hasProtectedData: boolean;
  requireConfirm?: boolean;
}):
  | { ok: true }
  | { ok: false; status: 400; error: string; code: string } {
  if (!input.hasProtectedData && !input.requireConfirm) {
    return { ok: true };
  }
  if (
    typeof input.confirm !== "string" ||
    !matchesDeleteConfirmText(input.confirm, input.expectedToken)
  ) {
    return rejected();
  }
  return { ok: true };
}

/**
 * Required expected-count fields must all be finite numbers; omitting any
 * yields the opaque delete rejection (no silent skip).
 */
export function evaluateRequiredExpectedCounts(input: {
  expectedExams: unknown;
  expectedSubmissions: unknown;
  expectedAnalysisJobs: unknown;
  expectedClasses?: unknown;
  requireClasses?: boolean;
}):
  | { ok: true }
  | { ok: false; status: 400; error: string; code: string } {
  if (
    !isFiniteNumber(input.expectedExams) ||
    !isFiniteNumber(input.expectedSubmissions) ||
    !isFiniteNumber(input.expectedAnalysisJobs)
  ) {
    return rejected();
  }
  if (input.requireClasses && !isFiniteNumber(input.expectedClasses)) {
    return rejected();
  }
  return { ok: true };
}

/**
 * Reject when exam/submission/analysisJob/(optional class) counts no longer
 * match the dialog snapshot. Omitting any required expected* field rejects.
 */
export function evaluateDeleteImpactFreshness(input: {
  expectedExams: unknown;
  expectedSubmissions: unknown;
  expectedAnalysisJobs: unknown;
  actualExams: number;
  actualSubmissions: number;
  actualAnalysisJobs: number;
  expectedClasses?: unknown;
  actualClasses?: number;
  requireClasses?: boolean;
}):
  | { ok: true }
  | { ok: false; status: 400; error: string; code: string } {
  const required = evaluateRequiredExpectedCounts({
    expectedExams: input.expectedExams,
    expectedSubmissions: input.expectedSubmissions,
    expectedAnalysisJobs: input.expectedAnalysisJobs,
    expectedClasses: input.expectedClasses,
    requireClasses: input.requireClasses,
  });
  if (!required.ok) return required;

  if (input.requireClasses) {
    if (
      !isFiniteNumber(input.expectedClasses) ||
      typeof input.actualClasses !== "number" ||
      !Number.isFinite(input.actualClasses)
    ) {
      return rejected();
    }
    if (input.actualClasses !== input.expectedClasses) {
      return rejected();
    }
  }

  if (
    input.actualExams !== input.expectedExams ||
    input.actualSubmissions !== input.expectedSubmissions ||
    input.actualAnalysisJobs !== input.expectedAnalysisJobs
  ) {
    return rejected();
  }
  return { ok: true };
}

/** Bulk delete_archived: always require confirm「刪除」plus all expected counts. */
export function evaluateBulkDeleteArchivedGuards(input: {
  confirm: unknown;
  expectedClasses: unknown;
  expectedExams: unknown;
  expectedSubmissions: unknown;
  expectedAnalysisJobs: unknown;
  actualClasses: number;
  actualExams: number;
  actualSubmissions: number;
  actualAnalysisJobs: number;
}):
  | { ok: true }
  | { ok: false; status: 400; error: string; code: string } {
  const confirmResult = evaluateDeleteConfirmation({
    confirm: input.confirm,
    expectedToken: ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
    hasProtectedData: true,
    requireConfirm: true,
  });
  if (!confirmResult.ok) return confirmResult;

  return evaluateDeleteImpactFreshness({
    expectedClasses: input.expectedClasses,
    expectedExams: input.expectedExams,
    expectedSubmissions: input.expectedSubmissions,
    expectedAnalysisJobs: input.expectedAnalysisJobs,
    actualClasses: input.actualClasses,
    actualExams: input.actualExams,
    actualSubmissions: input.actualSubmissions,
    actualAnalysisJobs: input.actualAnalysisJobs,
    requireClasses: true,
  });
}

/** Replace `{key}` placeholders in impact / prompt copy. */
export function fillDeleteImpactTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function sumClassImpact(input: {
  enrollmentCount: number;
  examCount: number;
  submissionCount: number;
  analysisJobCount: number;
}): DeleteImpactCounts {
  return {
    classes: 1,
    enrollments: input.enrollmentCount,
    exams: input.examCount,
    submissions: input.submissionCount,
    analysisJobs: input.analysisJobCount,
  };
}

export function sumClassesImpact(
  classes: Array<{
    enrollmentCount: number;
    examCount: number;
    submissionCount: number;
    analysisJobCount: number;
  }>,
): DeleteImpactCounts {
  return classes.reduce<DeleteImpactCounts>(
    (acc, row) => ({
      classes: acc.classes + 1,
      enrollments: acc.enrollments + row.enrollmentCount,
      exams: acc.exams + row.examCount,
      submissions: acc.submissions + row.submissionCount,
      analysisJobs: acc.analysisJobs + row.analysisJobCount,
    }),
    {
      classes: 0,
      enrollments: 0,
      exams: 0,
      submissions: 0,
      analysisJobs: 0,
    },
  );
}
