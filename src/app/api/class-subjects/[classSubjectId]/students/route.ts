import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import { addStudentsByEmail, listClassRoster } from "@/lib/enrollments/roster";
import { jsonError } from "@/lib/errors";

type Ctx = { params: Promise<{ classSubjectId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { classSubjectId } = await context.params;
    const roster = await listClassRoster(user, classSubjectId);
    return NextResponse.json(roster);
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list students", 500);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireSessionUser();
    const { classSubjectId } = await context.params;
    const body = (await request.json()) as { emails?: string };
    const results = await addStudentsByEmail(user, classSubjectId, body.emails ?? "");
    const roster = await listClassRoster(user, classSubjectId);
    return NextResponse.json({ ...roster, results });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not add students", 500);
    return NextResponse.json(body, { status });
  }
}
