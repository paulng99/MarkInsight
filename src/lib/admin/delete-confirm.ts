/**
 * Pure helpers for admin delete typed-confirmation UX and server guards.
 */

export type DeleteImpactCounts = {
  classes: number;
  enrollments: number;
  exams: number;
  submissions: number;
};

export const DELETE_CONFIRM_REQUIRED_CODE = "delete_confirm_required";

export const DELETE_CONFIRM_REQUIRED_MESSAGE =
  "Deletion requires confirm to match the subject code or class name";

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
}): boolean {
  return (
    input.submissionCount > 0 || (input.analysisJobCount ?? 0) > 0
  );
}

/**
 * Server-side delete confirmation.
 * When the target has submissions / analysis results, `confirm` must equal
 * the expected token (subject code or class name). Otherwise deletion may proceed.
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
    return {
      ok: false,
      status: 400,
      error: DELETE_CONFIRM_REQUIRED_MESSAGE,
      code: DELETE_CONFIRM_REQUIRED_CODE,
    };
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
