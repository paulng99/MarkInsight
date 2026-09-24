/**
 * Ensure demo school + class + enrollments exist for stub auth users.
 * Demo teacher/student ids match NextAuth DEMO_USERS.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  DEMO_SCHOOL_ID,
  ensureSchoolBootstrap,
} from "@/lib/school-settings";

export const DEMO_TEACHER_ID = "demo_teacher";
export const DEMO_STUDENT_ID = "demo_student";
export const DEMO_CLASS_SUBJECT_ID = "demo_class_math";

const STUB_PASSWORD = "password";

export type WorkspaceBootstrap = {
  schoolId: string;
  classSubjects: Array<{
    id: string;
    name: string;
    subjectCode: string;
    schoolYearId: string;
    schoolYearName: string;
  }>;
  allowTeacherUploadOnBehalf: boolean;
  allowTeacherCreateStudents: boolean;
};

async function upsertDemoUser(input: {
  id: string;
  email: string;
  name: string;
  role: "TEACHER" | "STUDENT";
  schoolId: string;
}) {
  const passwordHash = await bcrypt.hash(STUB_PASSWORD, 10);
  await prisma.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role,
      schoolId: input.schoolId,
      passwordHash,
    },
    update: {
      email: input.email,
      name: input.name,
      role: input.role,
      schoolId: input.schoolId,
    },
  });
}

/** Bootstrap demo tenant data used by teacher/student exam flows. */
export async function ensureDemoTeachingWorkspace(
  schoolId: string = DEMO_SCHOOL_ID,
): Promise<WorkspaceBootstrap> {
  await ensureSchoolBootstrap(schoolId);

  const settings = await prisma.schoolSettings.findUniqueOrThrow({
    where: { schoolId },
  });

  const year =
    (settings.defaultSchoolYearId
      ? await prisma.schoolYear.findUnique({
          where: { id: settings.defaultSchoolYearId },
        })
      : null) ??
    (await prisma.schoolYear.findFirst({
      where: { schoolId },
      orderBy: { startsOn: "desc" },
    }));

  if (!year) {
    throw new Error("No school year available for workspace bootstrap");
  }

  await upsertDemoUser({
    id: DEMO_TEACHER_ID,
    email: "teacher@example.com",
    name: "Demo Teacher",
    role: "TEACHER",
    schoolId,
  });
  await upsertDemoUser({
    id: DEMO_STUDENT_ID,
    email: "student@example.com",
    name: "Demo Student",
    role: "STUDENT",
    schoolId,
  });

  const classSubjects = await prisma.classSubject.findMany({
    where: {
      schoolId,
      enrollments: {
        some: { userId: DEMO_TEACHER_ID, role: "TEACHER" },
      },
    },
    include: { schoolYear: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return {
    schoolId,
    classSubjects: classSubjects.map((c) => ({
      id: c.id,
      name: c.name,
      subjectCode: c.subjectCode,
      schoolYearId: c.schoolYear.id,
      schoolYearName: c.schoolYear.name,
    })),
    allowTeacherUploadOnBehalf: settings.allowTeacherUploadOnBehalf,
    allowTeacherCreateStudents: settings.allowTeacherCreateStudents,
  };
}

/** Ensure a real teacher session user exists in DB and has class enrollments. */
export async function ensureTeacherWorkspace(input: {
  userId: string;
  email: string;
  name?: string | null;
  schoolId: string;
}): Promise<WorkspaceBootstrap> {
  const base = await ensureDemoTeachingWorkspace(input.schoolId);

  // Non-demo teachers created via admin still need at least one class.
  const passwordHash = await bcrypt.hash(STUB_PASSWORD, 10);
  await prisma.user.upsert({
    where: { id: input.userId },
    create: {
      id: input.userId,
      email: input.email,
      name: input.name ?? "Teacher",
      role: "TEACHER",
      schoolId: input.schoolId,
      passwordHash,
    },
    update: {
      schoolId: input.schoolId,
      role: "TEACHER",
      name: input.name ?? undefined,
    },
  });

  const classSubjects = await prisma.classSubject.findMany({
    where: {
      schoolId: input.schoolId,
      enrollments: {
        some: { userId: input.userId, role: "TEACHER" },
      },
    },
    include: { schoolYear: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return {
    ...base,
    classSubjects: classSubjects.map((c) => ({
      id: c.id,
      name: c.name,
      subjectCode: c.subjectCode,
      schoolYearId: c.schoolYear.id,
      schoolYearName: c.schoolYear.name,
    })),
  };
}

export async function ensureStudentWorkspace(input: {
  userId: string;
  email: string;
  name?: string | null;
  schoolId: string;
}): Promise<void> {
  await ensureDemoTeachingWorkspace(input.schoolId);
  const passwordHash = await bcrypt.hash(STUB_PASSWORD, 10);
  await prisma.user.upsert({
    where: { id: input.userId },
    create: {
      id: input.userId,
      email: input.email,
      name: input.name ?? "Student",
      role: "STUDENT",
      schoolId: input.schoolId,
      passwordHash,
    },
    update: {
      schoolId: input.schoolId,
      role: "STUDENT",
      name: input.name ?? undefined,
    },
  });

}
