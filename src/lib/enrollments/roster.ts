/**
 * Teacher roster: enroll existing students by email, or hold the email
 * until that student registers.
 */

import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { assertClassIsActive } from "@/lib/subjects/archive";

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

function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || email;
  return local.slice(0, 80);
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && String(error.code) === "P2002",
  );
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
  const target = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
  });
  if (!target) {
    throw new AppError("Class not found", 404, "class_not_found");
  }
  assertClassIsActive(target);
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

/**
 * Turn a roster email into a student account so a teacher can upload a script
 * before that student has registered. Password stays unset until they register.
 */
export async function claimPendingStudent(input: {
  schoolId: string;
  classSubjectId: string;
  email: string;
}): Promise<string> {
  const email = normalizeEmail(input.email);
  const schoolId = input.schoolId;
  const classSubjectId = input.classSubjectId;
  if (!isEmail(email)) {
    throw new AppError("Student is not in this class", 404, "not_enrolled");
  }

  const [pending, existing] = await Promise.all([
    prisma.pendingEnrollment.findUnique({
      where: { classSubjectId_email: { classSubjectId, email } },
    }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (pending && pending.schoolId !== schoolId) {
    throw new AppError("Student is not in this class", 404, "not_enrolled");
  }
  if (existing && (existing.role !== "STUDENT" || existing.schoolId !== schoolId)) {
    throw new AppError("Student is not in this class", 404, "not_enrolled");
  }
  if (!pending && !existing) {
    throw new AppError("Student is not in this class", 404, "not_enrolled");
  }

  if (!pending && existing) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { classSubjectId_userId: { classSubjectId, userId: existing.id } },
    });
    if (enrollment?.role !== "STUDENT") {
      throw new AppError("Student is not in this class", 404, "not_enrolled");
    }
    return existing.id;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      let userId = existing?.id;
      if (!userId) {
        const created = await tx.user.create({
          data: {
            email,
            name: nameFromEmail(email),
            role: "STUDENT",
            schoolId,
            passwordHash: null,
          },
        });
        userId = created.id;
      }
      const enrollment = await tx.enrollment.findUnique({
        where: { classSubjectId_userId: { classSubjectId, userId } },
      });
      if (enrollment && enrollment.role !== "STUDENT") {
        throw new AppError("Student is not in this class", 404, "not_enrolled");
      }
      if (!enrollment) {
        await tx.enrollment.create({
          data: { schoolId, classSubjectId, userId, role: "STUDENT" },
        });
      }
      await tx.pendingEnrollment.deleteMany({ where: { classSubjectId, email, schoolId } });
      return userId;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (!isPrismaUniqueConflict(error)) throw error;
    const again = await prisma.user.findUnique({ where: { email } });
    if (!again || again.role !== "STUDENT" || again.schoolId !== schoolId) {
      throw new AppError("Student is not in this class", 404, "not_enrolled");
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: { classSubjectId_userId: { classSubjectId, userId: again.id } },
    });
    if (enrollment?.role === "STUDENT") {
      await prisma.pendingEnrollment.deleteMany({ where: { classSubjectId, email, schoolId } });
      return again.id;
    }
    const stillPending = await prisma.pendingEnrollment.findUnique({
      where: { classSubjectId_email: { classSubjectId, email } },
    });
    if (!stillPending || stillPending.schoolId !== schoolId) {
      throw new AppError("Student is not in this class", 404, "not_enrolled");
    }
    return claimPendingStudent(input);
  }
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

  const [pending, existing] = await Promise.all([
    prisma.pendingEnrollment.findMany({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (existing?.passwordHash) {
    throw new AppError("An account with this email already exists", 409, "account_exists");
  }
  if (existing && existing.role !== "STUDENT") {
    throw new AppError("An account with this email already exists", 409, "account_exists");
  }

  const claimedByUpload = Boolean(
    existing && existing.role === "STUDENT" && existing.schoolId && !existing.passwordHash,
  );
  if (pending.length === 0 && !claimedByUpload) {
    throw new AppError("This email has not been added by a teacher", 400, "no_invite");
  }

  const schoolIds = [...new Set(pending.map((row) => row.schoolId))];
  if (existing?.schoolId && schoolIds.some((id) => id !== existing.schoolId)) {
    throw new AppError(
      "This email is reserved by more than one school",
      400,
      "conflicting_schools",
    );
  }
  if (!existing && schoolIds.length !== 1) {
    throw new AppError(
      "This email is reserved by more than one school",
      400,
      "conflicting_schools",
    );
  }
  const schoolId = existing?.schoolId ?? schoolIds[0];
  if (!schoolId) {
    throw new AppError("This email has not been added by a teacher", 400, "no_invite");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { name, passwordHash, schoolId, role: "STUDENT" },
          })
        : await tx.user.create({
            data: {
              email,
              name,
              passwordHash,
              role: "STUDENT",
              schoolId,
            },
          });
      if (pending.length > 0) {
        const already = await tx.enrollment.findMany({
          where: {
            userId: user.id,
            classSubjectId: { in: pending.map((row) => row.classSubjectId) },
          },
          select: { classSubjectId: true },
        });
        const taken = new Set(already.map((row) => row.classSubjectId));
        const toCreate = pending.filter((row) => !taken.has(row.classSubjectId));
        if (toCreate.length > 0) {
          await tx.enrollment.createMany({
            data: toCreate.map((row) => ({
              schoolId,
              classSubjectId: row.classSubjectId,
              userId: user.id,
              role: "STUDENT" as const,
            })),
          });
        }
        await tx.pendingEnrollment.deleteMany({ where: { email, schoolId } });
      }
      return user;
    });
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      throw new AppError("An account with this email already exists", 409, "account_exists");
    }
    throw error;
  }
}
