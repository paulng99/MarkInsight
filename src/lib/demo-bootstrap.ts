/**
 * Ensure demo school + class + enrollments exist for stub auth users.
 * Demo teacher/student ids match NextAuth DEMO_USERS.
 *
 * Demo users are only upserted when demo login policy is enabled
 * (MARKINSIGHT_DEMO_PASSWORD valid, or legacy ANALYSIS_DEMO path).
 * Production with demo login disabled will not create accounts that
 * accept the default password "password".
 */

import bcrypt from "bcryptjs";
import { getDemoLoginPolicy } from "@/lib/auth/demo-login-policy";
import { prisma } from "@/lib/prisma";
import {
  DEMO_SCHOOL_ID,
  ensureSchoolBootstrap,
} from "@/lib/school-settings";
import { activeClassWhere } from "@/lib/subjects/archive";

export const DEMO_TEACHER_ID = "demo_teacher";
export const DEMO_STUDENT_ID = "demo_student";
export const DEMO_ADMIN_ID = "demo_admin";
export const DEMO_CLASS_SUBJECT_ID = "demo_class_math";

const DEMO_STUB_IDS = new Set([DEMO_ADMIN_ID, DEMO_TEACHER_ID, DEMO_STUDENT_ID]);

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

async function upsertDemoUser(
  input: {
    id: string;
    email: string;
    name: string;
    role: "TEACHER" | "STUDENT";
    schoolId: string;
  },
  plainPassword: string,
) {
  const passwordHash = await bcrypt.hash(plainPassword, 10);
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
      passwordHash,
    },
  });
}

function isDemoUserId(userId: string): boolean {
  return DEMO_STUB_IDS.has(userId);
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

  const policy = getDemoLoginPolicy();
  if (policy.enabled && policy.password) {
    await upsertDemoUser(
      {
        id: DEMO_TEACHER_ID,
        email: "teacher@example.com",
        name: "Demo Teacher",
        role: "TEACHER",
        schoolId,
      },
      policy.password,
    );
    await upsertDemoUser(
      {
        id: DEMO_STUDENT_ID,
        email: "student@example.com",
        name: "Demo Student",
        role: "STUDENT",
        schoolId,
      },
      policy.password,
    );
  }

  const classSubjects = await prisma.classSubject.findMany({
    where: {
      schoolId,
      ...activeClassWhere,
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
  const policy = getDemoLoginPolicy();

  // Only hash a known demo password for stub demo users when demo login is on.
  // Real teachers should already exist (admin create / seed) with their own hash.
  const demoPassword =
    policy.enabled && policy.password && isDemoUserId(input.userId)
      ? policy.password
      : null;
  const passwordHash = demoPassword
    ? await bcrypt.hash(demoPassword, 10)
    : undefined;

  await prisma.user.upsert({
    where: { id: input.userId },
    create: {
      id: input.userId,
      email: input.email,
      name: input.name ?? "Teacher",
      role: "TEACHER",
      schoolId: input.schoolId,
      passwordHash: passwordHash ?? null,
    },
    update: {
      schoolId: input.schoolId,
      role: "TEACHER",
      name: input.name ?? undefined,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  const classSubjects = await prisma.classSubject.findMany({
    where: {
      schoolId: input.schoolId,
      ...activeClassWhere,
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
  const policy = getDemoLoginPolicy();
  const demoPassword =
    policy.enabled && policy.password && isDemoUserId(input.userId)
      ? policy.password
      : null;
  const passwordHash = demoPassword
    ? await bcrypt.hash(demoPassword, 10)
    : undefined;

  await prisma.user.upsert({
    where: { id: input.userId },
    create: {
      id: input.userId,
      email: input.email,
      name: input.name ?? "Student",
      role: "STUDENT",
      schoolId: input.schoolId,
      passwordHash: passwordHash ?? null,
    },
    update: {
      schoolId: input.schoolId,
      role: "STUDENT",
      name: input.name ?? undefined,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
}
