import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import {
  enqueueAnalyzeExam,
  enqueueAnalyzeSubmission,
} from "@/lib/jobs/analyze-exam";
import { assertTeacherOwnsExam } from "@/lib/exams/service";

/**
 * Enqueue analysis — teacher only.
 * Body: { examId, submissionId? }
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { examId?: string; submissionId?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    if (!body.examId) {
      return NextResponse.json({ error: "examId is required" }, { status: 400 });
    }

    const exam = await assertTeacherOwnsExam(user, body.examId);

    if (body.submissionId) {
      const result = await enqueueAnalyzeSubmission({
        schoolId: exam.schoolId,
        examId: exam.id,
        submissionId: body.submissionId,
        requestedByUserId: user.id,
      });
      return NextResponse.json(result);
    }

    const result = await enqueueAnalyzeExam({
      schoolId: exam.schoolId,
      examId: exam.id,
      requestedByUserId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = jsonError(error, "Could not enqueue analysis", 500);
    return NextResponse.json(body, { status });
  }
}
