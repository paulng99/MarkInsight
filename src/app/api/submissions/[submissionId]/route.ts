import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { assertStudentOwnsSubmission, formatDateYmd } from "@/lib/exams/service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ submissionId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { submissionId } = await context.params;
    const submission = await assertStudentOwnsSubmission(user, submissionId);

    const aggregates = await prisma.subjectAggregate.findMany({
      where: {
        schoolId: submission.schoolId,
        enrollmentId: submission.enrollmentId,
        classSubjectId: submission.exam.classSubjectId,
      },
      orderBy: [{ topic: "asc" }, { itemType: "asc" }],
    });

    return NextResponse.json({
      submission: {
        id: submission.id,
        status: submission.status,
        errorMessage: submission.errorMessage,
        scoringLlmModel: submission.scoringLlmModel,
        analyzedAt: submission.analyzedAt?.toISOString() ?? null,
        exam: {
          id: submission.exam.id,
          title: submission.exam.title,
          examDate: formatDateYmd(submission.exam.examDate),
          classSubject: {
            id: submission.exam.classSubject.id,
            name: submission.exam.classSubject.name,
            subjectCode: submission.exam.classSubject.subjectCode,
          },
        },
        student: submission.student,
        questionScores: submission.questionScores.map((q) => ({
          questionKey: q.questionKey,
          topic: q.topic,
          itemType: q.itemType,
          score: q.score,
          maxScore: q.maxScore,
          feedback: q.feedback,
        })),
        jobs: submission.analysisJobs.map((j) => ({
          id: j.id,
          status: j.status,
          kind: j.kind,
          llmModel: j.llmModel,
          errorMessage: j.errorMessage,
          createdAt: j.createdAt.toISOString(),
          finishedAt: j.finishedAt?.toISOString() ?? null,
        })),
        aggregates: aggregates.map((a) => ({
          topic: a.topic,
          itemType: a.itemType,
          avgScoreRatio: a.avgScoreRatio,
          attemptCount: a.attemptCount,
        })),
      },
    });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load result", 500);
    return NextResponse.json(body, { status });
  }
}
