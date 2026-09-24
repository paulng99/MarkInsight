import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { distributeExamToClasses } from "@/lib/exams/service";

type Ctx = { params: Promise<{ examId: string }> };

/** Copy a prepared exam onto selected classes of the same subject. */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { examId } = await context.params;
    const body = (await request.json()) as { classSubjectIds?: string[] };
    const classSubjectIds = body.classSubjectIds ?? [];
    const exams = await distributeExamToClasses(user, examId, classSubjectIds);
    return NextResponse.json({ exams });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not distribute exam", 500);
    return NextResponse.json(body, { status });
  }
}
