import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import { ensureTeacherWorkspace } from "@/lib/demo-bootstrap";
import { DEMO_SCHOOL_ID } from "@/lib/school-settings";
import { listTeacherSubjectGroups } from "@/lib/subjects/syllabus";

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const schoolId = user.schoolId ?? DEMO_SCHOOL_ID;
    if (user.role === "TEACHER") {
      await ensureTeacherWorkspace({
        userId: user.id,
        email: user.email,
        name: user.name,
        schoolId,
      });
    }
    const subjects = await listTeacherSubjectGroups({
      ...user,
      schoolId: user.schoolId ?? schoolId,
    });
    return NextResponse.json({ subjects });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not list subjects", 500);
    return NextResponse.json(body, { status });
  }
}
