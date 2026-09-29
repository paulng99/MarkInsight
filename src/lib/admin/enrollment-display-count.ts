/**
 * Display enrollment counts for the admin subjects list and delete dialog.
 *
 * Counts Enrollment rows with role STUDENT only.
 * TEACHER enrollments and PendingEnrollment emails are not included.
 * Cascade delete still removes all enrollments and pending rows for the class.
 */

export const ADMIN_LIST_STUDENT_ENROLLMENT_WHERE = {
  role: "STUDENT" as const,
};

/** Prisma `_count.select` fragment used by listAdminSubjectGroups. */
export function buildAdminClassEnrollmentCountSelect() {
  return {
    enrollments: { where: ADMIN_LIST_STUDENT_ENROLLMENT_WHERE },
    exams: true as const,
  };
}

/** Sum per-class student enrollment counts after the STUDENT filter is applied. */
export function sumDisplayedStudentEnrollments(
  classRows: ReadonlyArray<{ enrollmentCount: number }>,
): number {
  return classRows.reduce((n, row) => n + row.enrollmentCount, 0);
}
