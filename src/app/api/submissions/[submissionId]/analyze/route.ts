import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { assertStudentOwnsSubmission } from "@/lib/exams/service";
import { enqueueAnalyzeSubmission } from "@/lib/jobs/analyze-exam";

type Ctx = { params: Promise<{ submissionId: string }> };

/** Retry / re-queue submission scoring. */
export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { submissionId } = await context.params;
    const submission = await assertStudentOwnsSubmission(user, submissionId);
    const job = await enqueueAnalyzeSubmission({
      schoolId: submission.schoolId,
      examId: submission.examId,
      submissionId: submission.id,
      requestedByUserId: user.id,
    });
    return NextResponse.json(job);
  } catch (error) {
    const { body, status } = jsonError(error, "Could not start analysis", 500);
    return NextResponse.json(body, { status });
  }
}
