import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { getStudentWeaknessForUser } from "@/lib/aggregates/weakness";

type Ctx = { params: Promise<{ classSubjectId: string }> };

/**
 * GET /api/class-subjects/[classSubjectId]/weakness?studentId=
 * Student: own same-subject cross-exam weakness (≥2 succeeded exams → ready).
 * Teacher: class-scoped view of a student (studentId required).
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { classSubjectId } = await context.params;
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId");

    const summary = await getStudentWeaknessForUser(
      user,
      classSubjectId,
      studentId,
    );

    return NextResponse.json({ weakness: summary });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load weakness summary", 500);
    return NextResponse.json(body, { status });
  }
}
