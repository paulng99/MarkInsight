/**
 * Class-wide single-exam summary from stored QuestionScore rows.
 * Reuses succeeded (DONE) submissions only — no extra LLM calls.
 */

import {
  aggregateClassExamScores,
  type ClassQuestionAggregate,
  type ClassTopicAggregate,
} from "./exam-summary-aggregate";
import { AppError } from "@/lib/errors";
import { assertTeacherOwnsExam, requireSchoolId } from "@/lib/exams/service";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { assertClassIsActive } from "@/lib/subjects/archive";

export {
  aggregateClassExamScores,
  type ClassQuestionAggregate,
  type ClassTopicAggregate,
  type QuestionScoreInput,
} from "./exam-summary-aggregate";

export type ClassExamSummary = {
  exam: { id: string; title: string };
  classSubject: { id: string; name: string };
  /** Students with a succeeded (DONE) analysis for this exam. */
  uploadedCount: number;
  /** Active enrolled students in the exam's class. */
  enrolledCount: number;
  questions: ClassQuestionAggregate[];
  topics: ClassTopicAggregate[];
  weakestThree: ClassQuestionAggregate[];
};

/**
 * Teacher who teaches the class, or school admin. Students → 403.
 * Archived classes follow assertClassIsActive (409).
 */
export async function getClassExamSummaryForUser(
  user: SessionUser,
  examId: string,
): Promise<ClassExamSummary> {
  requireSchoolId(user);

  if (user.role === "STUDENT") {
    throw new AppError("Forbidden", 403, "forbidden");
  }

  const exam = await assertTeacherOwnsExam(user, examId);
  assertClassIsActive(exam.classSubject);

  const enrolledCount = await prisma.enrollment.count({
    where: {
      classSubjectId: exam.classSubjectId,
      schoolId: exam.schoolId,
      role: "STUDENT",
    },
  });

  const submissions = await prisma.submission.findMany({
    where: {
      examId: exam.id,
      schoolId: exam.schoolId,
      status: "DONE",
    },
    include: {
      questionScores: {
        select: {
          questionKey: true,
          topic: true,
          score: true,
          maxScore: true,
        },
      },
    },
  });

  const uploadedCount = submissions.length;
  const aggregated =
    uploadedCount === 0
      ? { questions: [], topics: [], weakestThree: [] }
      : aggregateClassExamScores(
          submissions.map((s) => ({ scores: s.questionScores })),
        );

  return {
    exam: { id: exam.id, title: exam.title },
    classSubject: {
      id: exam.classSubject.id,
      name: exam.classSubject.name,
    },
    uploadedCount,
    enrolledCount,
    questions: aggregated.questions,
    topics: aggregated.topics,
    weakestThree: aggregated.weakestThree,
  };
}
