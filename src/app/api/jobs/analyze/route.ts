import { auth } from "@/auth";
import { enqueueAnalyzeExam } from "@/lib/jobs/analyze-exam";
import { NextResponse } from "next/server";

/**
 * Dev/stub endpoint — demonstrates the analysis job stub.
 * TODO(knife-1): require teacher role + schoolId checks; accept real examId from DB.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { examId?: string; submissionId?: string; schoolId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const schoolId = body.schoolId ?? session.user.schoolId ?? "demo_school";
  const examId = body.examId ?? "demo_exam";

  const result = await enqueueAnalyzeExam({
    schoolId,
    examId,
    submissionId: body.submissionId,
    requestedByUserId: session.user.id,
  });

  return NextResponse.json(result);
}
