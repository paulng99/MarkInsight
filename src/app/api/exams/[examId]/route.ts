import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import {
  assertTeacherOwnsExam,
  formatDateYmd,
  listExamsForStudent,
} from "@/lib/exams/service";
import { getExamStructureQuestions } from "@/lib/jobs/analyze-exam";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ examId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { examId } = await context.params;

    if (user.role === "TEACHER" || user.role === "ADMIN") {
      const exam = await assertTeacherOwnsExam(user, examId);
      const structureQuestions =
        (await getExamStructureQuestions(examId)) ?? [];
      return NextResponse.json({
        exam: {
          id: exam.id,
          title: exam.title,
          examDate: formatDateYmd(exam.examDate),
          classSubjectId: exam.classSubjectId,
          classSubject: {
            id: exam.classSubject.id,
            name: exam.classSubject.name,
            subjectCode: exam.classSubject.subjectCode,
          },
          structureLlmModel: exam.structureLlmModel,
          structureQuestions,
          assets: exam.assets.map((a) => ({
            id: a.id,
            kind: a.kind,
            originalName: a.originalName,
            mimeType: a.mimeType,
            createdAt: a.createdAt.toISOString(),
          })),
          latestStructureJobs: exam.analysisJobs.map((j) => ({
            id: j.id,
            status: j.status,
            llmModel: j.llmModel,
            errorMessage: j.errorMessage,
            createdAt: j.createdAt.toISOString(),
            finishedAt: j.finishedAt?.toISOString() ?? null,
          })),
        },
      });
    }

    if (user.role === "STUDENT") {
      const exams = await listExamsForStudent(user);
      const exam = exams.find((e) => e.id === examId);
      if (!exam) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const submission = exam.submissions[0]
        ? await prisma.submission.findUnique({
            where: { id: exam.submissions[0].id },
            include: {
              analysisJobs: { orderBy: { createdAt: "desc" }, take: 3 },
            },
          })
        : null;
      return NextResponse.json({
        exam: {
          id: exam.id,
          title: exam.title,
          examDate: formatDateYmd(exam.examDate),
          classSubject: exam.classSubject,
          structureLlmModel: exam.structureLlmModel,
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                scoringLlmModel: submission.scoringLlmModel,
                errorMessage: submission.errorMessage,
                jobs: submission.analysisJobs.map((j) => ({
                  id: j.id,
                  status: j.status,
                  errorMessage: j.errorMessage,
                })),
              }
            : null,
        },
      });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load exam", 500);
    return NextResponse.json(body, { status });
  }
}
