import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { listStudentClassSubjects } from "@/lib/aggregates/weakness";

/** GET /api/student/subjects — enrolled subjects + succeeded exam counts. */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const subjects = await listStudentClassSubjects(user);
    return NextResponse.json({ subjects });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load subjects", 500);
    return NextResponse.json(body, { status });
  }
}
