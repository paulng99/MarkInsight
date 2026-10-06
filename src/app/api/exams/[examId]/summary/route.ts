import { NextResponse } from "next/server";
import { getClassExamSummaryForUser } from "@/lib/aggregates/exam-summary";
import { requireSessionUser } from "@/lib/api/session";
import { jsonError } from "@/lib/errors";

type Ctx = { params: Promise<{ examId: string }> };

/**
 * GET /api/exams/[examId]/summary
 * Teacher (owns class) or school admin: class-wide aggregate for one exam.
 * Students → 403. No student names/IDs in the payload.
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { examId } = await context.params;
    const summary = await getClassExamSummaryForUser(user, examId);
    return NextResponse.json({ summary });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load class exam summary", 500);
    return NextResponse.json(body, { status });
  }
}
