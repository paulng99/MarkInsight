import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireSessionUser } from "@/lib/api/session";
import {
  ensureStudentWorkspace,
  ensureTeacherWorkspace,
} from "@/lib/demo-bootstrap";
import { DEMO_SCHOOL_ID } from "@/lib/school-settings";
import { prisma } from "@/lib/prisma";

/** Bootstrap teaching workspace for the signed-in teacher or student. */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const schoolId = user.schoolId ?? DEMO_SCHOOL_ID;

    if (user.role === "TEACHER") {
      const workspace = await ensureTeacherWorkspace({
        userId: user.id,
        email: user.email,
        name: user.name,
        schoolId,
      });
      return NextResponse.json(workspace);
    }

    if (user.role === "STUDENT") {
      await ensureStudentWorkspace({
        userId: user.id,
        email: user.email,
        name: user.name,
        schoolId,
      });
      const settings = await prisma.schoolSettings.findUnique({
        where: { schoolId },
      });
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: user.id, schoolId, role: "STUDENT" },
        include: {
          classSubject: {
            include: { schoolYear: { select: { id: true, name: true } } },
          },
        },
      });
      return NextResponse.json({
        schoolId,
        classSubjects: enrollments.map((e) => ({
          id: e.classSubject.id,
          name: e.classSubject.name,
          subjectCode: e.classSubject.subjectCode,
          schoolYearId: e.classSubject.schoolYear.id,
          schoolYearName: e.classSubject.schoolYear.name,
        })),
        allowTeacherUploadOnBehalf: settings?.allowTeacherUploadOnBehalf ?? false,
        allowTeacherCreateStudents: settings?.allowTeacherCreateStudents ?? false,
      });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    const { body, status } = jsonError(error, "Could not load workspace", 500);
    return NextResponse.json(body, { status });
  }
}
