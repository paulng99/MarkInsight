import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { startExamStructureAnalysis } from "@/lib/exams/service";

type Ctx = { params: Promise<{ examId: string }> };

/** Trigger exam-structure analysis job. */
export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { examId } = await context.params;
    const result = await startExamStructureAnalysis(user, examId);
    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = jsonError(error, "Could not start analysis", 500);
    return NextResponse.json(body, { status });
  }
}
