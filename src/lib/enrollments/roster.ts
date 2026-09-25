/**
 * Teacher roster: enroll existing students by email, or hold the email
 * until that student registers.
 */

import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BATCH = 100;

export type RosterStatus = "enrolled" | "pending" | "already" | "rejected";

export type RosterAddResult = {
  email: string;
  status: RosterStatus;
  code?: "invalid_email" | "not_student" | "other_school";
};

function requireSchoolId(user: SessionUser): string {
  if (!user.schoolId) {
    throw new AppError("School context required", 403, "no_school");
  }
  return user.schoolId;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const email = normalizeEmail(part);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function isEmail(email: string): boolean {
  return email.length <= 254 && EMAIL.test(email);
}

async function assertTeacherOwnsClass(user: SessionUser, classSubjectId: string) {
  const schoolId = requireSchoolId(user);
  if (user.role !== "TEACHER") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const owned = await prisma.enrollment.findFirst({
    where: {
      classSubjectId,
      userId: user.id,
      schoolId,
      role: "TEACHER",
    },
  });
  if (!owned) {
    throw new AppError("Class not found", 404, "class_not_found");
  }
  return { schoolId, classSubjectId };
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function listClassRoster(user: SessionUser, classSubjectId: string) {
  const { schoolId } = await assertTeacherOwnsClass(user, classSubjectId);
  const [enrolled, pending] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classSubjectId, schoolId, role: "STUDENT" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { email: "asc" } },
    }),
    prisma.pendingEnrollment.findMany({
      where: { classSubjectId, schoolId },
      orderBy: { email: "asc" },
    }),
  ]);
  return {
    students: enrolled.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
    })),
    pending: pending.map((row) => ({
      email: row.email,
      createdAt: formatDateYmd(row.createdAt),
    })),
  };
}

export async function addStudentsByEmail(
  user: SessionUser,
  classSubjectId: string,
  raw: string,
): Promise<RosterAddResult[]> {
  const { schoolId } = await assertTeacherOwnsClass(user, classSubjectId);
  const emails = parseEmailList(raw);
  if (emails.length === 0) {
    throw new AppError("Enter at least one email", 400, "emails_required");
  }
  if (emails.length > MAX_BATCH) {
    throw new AppError("Too many emails", 400, "too_many_emails");
  }

  const results: RosterAddResult[] = [];
  for (const email of emails) {
    if (!isEmail(email)) {
      results.push({ email, status: "rejected", code: "invalid_email" });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== "STUDENT" || existing.schoolId !== schoolId) {
        results.push({
          email,
          status: "rejected",
          code: existing.schoolId !== schoolId ? "other_school" : "not_student",
        });
        continue;
      }
      const enrollment = await prisma.enrollment.findUnique({
        where: { classSubjectId_userId: { classSubjectId, userId: existing.id } },
      });
      if (enrollment?.role === "STUDENT") {
        await prisma.pendingEnrollment.deleteMany({ where: { classSubjectId, email } });
        results.push({ email, status: "already" });
        continue;
      }
      if (enrollment) {
        results.push({ email, status: "rejected", code: "not_student" });
        continue;
      }
      await prisma.enrollment.create({
        data: {
          schoolId,
          classSubjectId,
          userId: existing.id,
          role: "STUDENT",
        },
      });
      await prisma.pendingEnrollment.deleteMany({ where: { classSubjectId, email } });
      results.push({ email, status: "enrolled" });
      continue;
    }

    const otherSchool = await prisma.pendingEnrollment.findFirst({
      where: { email, schoolId: { not: schoolId } },
    });
    if (otherSchool) {
      results.push({ email, status: "rejected", code: "other_school" });
      continue;
    }

    await prisma.pendingEnrollment.upsert({
      where: { classSubjectId_email: { classSubjectId, email } },
      create: { schoolId, classSubjectId, email },
      update: {},
    });
    results.push({ email, status: "pending" });
  }
  return results;
}

export async function registerInvitedStudent(input: {
  email: string;
  name: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!isEmail(email)) {
    throw new AppError("Invalid email", 400, "invalid_email");
  }
  if (!name || name.length > 80) {
    throw new AppError("Name is required", 400, "invalid_name");
  }
  if (input.password.length < 8 || input.password.length > 72) {
    throw new AppError("Password must be at least 8 characters", 400, "invalid_password");
  }

  const pending = await prisma.pendingEnrollment.findMany({ where: { email } });
  if (pending.length === 0) {
    throw new AppError("This email has not been added by a teacher", 400, "no_invite");
  }
  const schoolIds = [...new Set(pending.map((row) => row.schoolId))];
  if (schoolIds.length !== 1) {
    throw new AppError("This email is reserved by more than one school", 400, "conflicting_schools");
  }
  const schoolId = schoolIds[0]!;

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    throw new AppError("An account with this email already exists", 409, "account_exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "STUDENT",
          schoolId,
        },
      });
      await tx.enrollment.createMany({
        data: pending.map((row) => ({
          schoolId,
          classSubjectId: row.classSubjectId,
          userId: user.id,
          role: "STUDENT" as const,
        })),
      });
      await tx.pendingEnrollment.deleteMany({ where: { email, schoolId } });
      return user;
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") {
      throw new AppError("An account with this email already exists", 409, "account_exists");
    }
    throw error;
  }
}
