/**
 * Pure helpers for admin delete typed-confirmation UX.
 */

export type DeleteImpactCounts = {
  classes: number;
  enrollments: number;
  exams: number;
  submissions: number;
};

/** Confirm is enabled only when the trimmed input equals the expected token exactly. */
export function matchesDeleteConfirmText(
  input: string,
  expected: string,
): boolean {
  return input.trim() === expected;
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
