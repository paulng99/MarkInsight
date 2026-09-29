import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_LIST_STUDENT_ENROLLMENT_WHERE,
  buildAdminClassEnrollmentCountSelect,
  sumDisplayedStudentEnrollments,
} from "./enrollment-display-count.ts";
import { fillDeleteImpactTemplate, sumClassesImpact } from "./delete-confirm.ts";

test("admin display enrollment count filters to STUDENT role only", () => {
  assert.deepEqual(ADMIN_LIST_STUDENT_ENROLLMENT_WHERE, { role: "STUDENT" });
  const select = buildAdminClassEnrollmentCountSelect();
  assert.deepEqual(select.enrollments.where, { role: "STUDENT" });
  assert.notEqual(select.enrollments.where.role, "TEACHER");
});

test("displayed enrollment total sums student counts and excludes teachers/pending by construction", () => {
  // After Prisma applies role=STUDENT, teacher rows are absent from _count.
  // PendingEnrollment is a separate model and never appears in enrollmentCount.
  const afterServerFilter = [
    { enrollmentCount: 25, examCount: 1, submissionCount: 0, analysisJobCount: 0 },
    { enrollmentCount: 0, examCount: 0, submissionCount: 0, analysisJobCount: 0 },
  ];
  assert.equal(sumDisplayedStudentEnrollments(afterServerFilter), 25);
  assert.equal(sumClassesImpact(afterServerFilter).enrollments, 25);
});

test("roster impact line uses the displayed student enrollment count", () => {
  assert.equal(
    fillDeleteImpactTemplate("班別學生名單（{enrollments} 人）將一併刪除。", {
      enrollments: sumDisplayedStudentEnrollments([
        { enrollmentCount: 12 },
        { enrollmentCount: 3 },
      ]),
    }),
    "班別學生名單（15 人）將一併刪除。",
  );
});
