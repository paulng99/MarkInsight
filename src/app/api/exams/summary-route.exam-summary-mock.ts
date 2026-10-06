/**
 * Test-only stand-in for `@/lib/aggregates/exam-summary` used by summary-route.test.ts.
 * Keeps RBAC outcomes without loading exams/service → LLM clients.
 */

import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/rbac";

type SummaryState = { teacherOwnsClass: boolean };

function state(): SummaryState {
  return (
    globalThis as unknown as { __MI_SUMMARY_STATE__: SummaryState }
  ).__MI_SUMMARY_STATE__;
}

export async function getClassExamSummaryForUser(
  user: SessionUser,
  examId: string,
) {
  if (user.role === "STUDENT") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (user.role === "TEACHER" && !state().teacherOwnsClass) {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  return {
    exam: { id: examId, title: "Midterm" },
    classSubject: { id: "cs-1", name: "3A Maths" },
    uploadedCount: 1,
    enrolledCount: 5,
    questions: [
      {
        questionKey: "Q1",
        topic: "Algebra",
        avgScoreRatio: 0.4,
        attemptCount: 1,
      },
    ],
    topics: [{ topic: "Algebra", avgScoreRatio: 0.4, attemptCount: 1 }],
    weakestThree: [
      {
        questionKey: "Q1",
        topic: "Algebra",
        avgScoreRatio: 0.4,
        attemptCount: 1,
      },
    ],
  };
}
