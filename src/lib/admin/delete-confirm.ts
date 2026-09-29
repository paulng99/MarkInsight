/**
 * Pure helpers for admin delete typed-confirmation UX and server guards.
 */

export type DeleteImpactCounts = {
  classes: number;
  enrollments: number;
  exams: number;
  submissions: number;
};

/** Opaque code for any failed admin subject/class delete. */
export const ADMIN_DELETE_REJECTED_CODE = "delete_rejected";

/**
 * Opaque English API copy — must not reveal cross-school existence,
 * confirm mismatch details, or whether a row was found.
 */
export const ADMIN_DELETE_REJECTED_MESSAGE_EN =
  "Could not delete: the data has changed or you do not have permission. Refresh the page and try again.";

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

/** True when deleting would remove answer scripts or analysis results. */
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

/**
 * Server-side delete confirmation.
 * When the target has exams / submissions / analysis results, `confirm` must
 * equal the expected token (subject code or class name).
 */
export function evaluateDeleteConfirmation(input: {
  confirm: unknown;
  expectedToken: string;
  hasProtectedData: boolean;
}):
  | { ok: true }
  | { ok: false; status: 400; error: string; code: string } {
  if (!input.hasProtectedData) {
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
 * Reject when exam/submission counts no longer match the dialog snapshot
 * (e.g. another user added an exam while the confirm dialog was open).
 */
export function evaluateDeleteImpactFreshness(input: {
  expectedExams: unknown;
  expectedSubmissions: unknown;
  actualExams: number;
  actualSubmissions: number;
}):
  | { ok: true }
  | { ok: false; status: 400; error: string; code: string } {
  if (
    typeof input.expectedExams !== "number" ||
    typeof input.expectedSubmissions !== "number" ||
    !Number.isFinite(input.expectedExams) ||
    !Number.isFinite(input.expectedSubmissions)
  ) {
    if (input.actualExams > 0 || input.actualSubmissions > 0) {
      return rejected();
    }
    return { ok: true };
  }
  if (
    input.actualExams !== input.expectedExams ||
    input.actualSubmissions !== input.expectedSubmissions
  ) {
    return rejected();
  }
  return { ok: true };
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
}): DeleteImpactCounts {
  return {
    classes: 1,
    enrollments: input.enrollmentCount,
    exams: input.examCount,
    submissions: input.submissionCount,
  };
}

export function sumClassesImpact(
  classes: Array<{
    enrollmentCount: number;
    examCount: number;
    submissionCount: number;
  }>,
): DeleteImpactCounts {
  return classes.reduce<DeleteImpactCounts>(
    (acc, row) => ({
      classes: acc.classes + 1,
      enrollments: acc.enrollments + row.enrollmentCount,
      exams: acc.exams + row.examCount,
      submissions: acc.submissions + row.submissionCount,
    }),
    { classes: 0, enrollments: 0, exams: 0, submissions: 0 },
  );
}
