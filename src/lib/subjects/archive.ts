/**
 * Teacher archive, restore, and permanent delete for subjects and classes.
 *
 * A class is usable only when admin archivedAt and both teacher timestamps
 * (classArchivedAt / subjectArchivedAt) are empty. Archiving a subject stamps
 * subjectArchivedAt on every class this teacher teaches for that subject code.
 * Restoring the subject clears that stamp and leaves classArchivedAt untouched.
 * Admin school-wide archive uses ClassSubject.archivedAt (see admin/class-subjects).
 */

import { unlink } from "fs/promises";
import path from "path";
import {
  evaluateDeleteConfirmation,
} from "@/lib/admin/delete-confirm";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { deleteObject } from "@/lib/storage";
import {
  activeClassWhere,
  formatArchiveDate,
  isClassInactive,
} from "@/lib/subjects/archive-state";

export { activeClassWhere, formatArchiveDate, isClassInactive };

export type TeacherDeleteImpact = {
  examCount: number;
  submissionCount: number;
};

export type TeacherDeleteOptions = {
  confirm?: unknown;
};

export function assertClassIsActive(row: {
  archivedAt?: Date | null;
  classArchivedAt: Date | null;
  subjectArchivedAt: Date | null;
}) {
  if (isClassInactive(row)) {
    throw new AppError("此班別已封存，不能再使用。", 409, "class_archived");
  }
}

const SUBJECT_CODE = /^[\p{L}\p{N}._-]{1,32}$/u;

function assertSubjectCode(raw: string): string {
  const code = raw.trim();
  if (!SUBJECT_CODE.test(code)) {
    throw new AppError("Invalid subject code", 400, "invalid_subject");
  }
  return code;
}

function requireTeacher(user: SessionUser): string {
  if (user.role !== "TEACHER") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (!user.schoolId) {
    throw new AppError("School context required", 403, "no_school");
  }
  return user.schoolId;
}

function teacherClassWhere(schoolId: string, teacherId: string, subjectCode: string) {
  return {
    schoolId,
    subjectCode,
    enrollments: {
      some: { userId: teacherId, schoolId, role: "TEACHER" as const },
    },
  };
}

async function teacherClassesForSubject(
  schoolId: string,
  teacherId: string,
  subjectCode: string,
) {
  return prisma.classSubject.findMany({
    where: teacherClassWhere(schoolId, teacherId, subjectCode),
    orderBy: { name: "asc" },
  });
}

async function ownedClass(user: SessionUser, classSubjectId: string) {
  const schoolId = requireTeacher(user);
  const cs = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
  });
  if (!cs) {
    throw new AppError("Class not found", 404, "class_not_found");
  }
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      classSubjectId,
      userId: user.id,
      schoolId,
      role: "TEACHER",
    },
  });
  if (!enrollment) {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  return { schoolId, cs };
}

/** DB counts for permanent-delete impact copy (teacher archive UI + server). */
export async function countTeacherDeleteImpactForClass(
  schoolId: string,
  classSubjectId: string,
): Promise<TeacherDeleteImpact> {
  const [examCount, submissionCount] = await Promise.all([
    prisma.exam.count({ where: { schoolId, classSubjectId } }),
    prisma.submission.count({
      where: { schoolId, exam: { classSubjectId } },
    }),
  ]);
  return { examCount, submissionCount };
}

export async function countTeacherDeleteImpactForSubject(
  schoolId: string,
  teacherId: string,
  subjectCode: string,
): Promise<TeacherDeleteImpact> {
  const classes = await teacherClassesForSubject(schoolId, teacherId, subjectCode);
  const ids = classes.map((row) => row.id);
  if (ids.length === 0) {
    return { examCount: 0, submissionCount: 0 };
  }
  const [examCount, submissionCount] = await Promise.all([
    prisma.exam.count({
      where: { schoolId, classSubjectId: { in: ids } },
    }),
    prisma.submission.count({
      where: { schoolId, exam: { classSubjectId: { in: ids } } },
    }),
  ]);
  return { examCount, submissionCount };
}

function assertTeacherDeleteConfirm(input: {
  confirm: unknown;
  expectedToken: string;
}): void {
  const result = evaluateDeleteConfirmation({
    confirm: input.confirm,
    expectedToken: input.expectedToken,
    hasProtectedData: true,
    requireConfirm: true,
  });
  if (!result.ok) {
    throw new AppError(result.error, result.status, result.code);
  }
}

async function removeExamStructureFile(examId: string) {
  const file = path.join(process.cwd(), ".data", "exam-structure", `${examId}.json`);
  try {
    await unlink(file);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
  }
}

async function purgeClassSubject(schoolId: string, classSubjectId: string) {
  const exams = await prisma.exam.findMany({
    where: { classSubjectId, schoolId },
    select: {
      id: true,
      assets: { select: { storageKey: true } },
    },
  });
  const keys = new Set<string>();
  for (const exam of exams) {
    for (const asset of exam.assets) keys.add(asset.storageKey);
  }

  await prisma.classSubject.delete({ where: { id: classSubjectId } });

  for (const key of keys) {
    const stillUsed = await prisma.asset.count({ where: { storageKey: key } });
    if (stillUsed === 0) await deleteObject(key);
  }
  for (const exam of exams) {
    await removeExamStructureFile(exam.id);
  }
}

async function deleteSyllabusIfUnused(schoolId: string, subjectCode: string) {
  const remaining = await prisma.classSubject.count({
    where: { schoolId, subjectCode },
  });
  if (remaining > 0) return;
  const syllabus = await prisma.subjectSyllabus.findUnique({
    where: { schoolId_subjectCode: { schoolId, subjectCode } },
  });
  if (!syllabus) return;
  await prisma.subjectSyllabus.delete({ where: { id: syllabus.id } });
  await deleteObject(syllabus.storageKey);
}

export async function archiveSubject(user: SessionUser, rawCode: string) {
  const schoolId = requireTeacher(user);
  const subjectCode = assertSubjectCode(rawCode);
  const classes = await teacherClassesForSubject(schoolId, user.id, subjectCode);
  if (classes.length === 0) {
    throw new AppError("Subject not found", 404, "subject_not_found");
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.classSubject.updateMany({
      where: {
        id: { in: classes.map((row) => row.id) },
        subjectArchivedAt: null,
      },
      data: { subjectArchivedAt: now },
    }),
    prisma.subjectArchive.upsert({
      where: {
        schoolId_teacherId_subjectCode: {
          schoolId,
          teacherId: user.id,
          subjectCode,
        },
      },
      create: {
        schoolId,
        teacherId: user.id,
        subjectCode,
        archivedAt: now,
      },
      update: {},
    }),
  ]);
}

export async function restoreSubject(user: SessionUser, rawCode: string) {
  const schoolId = requireTeacher(user);
  const subjectCode = assertSubjectCode(rawCode);
  const archive = await prisma.subjectArchive.findUnique({
    where: {
      schoolId_teacherId_subjectCode: {
        schoolId,
        teacherId: user.id,
        subjectCode,
      },
    },
  });
  if (!archive) {
    throw new AppError("Subject not found", 404, "subject_not_found");
  }
  const classes = await teacherClassesForSubject(schoolId, user.id, subjectCode);
  await prisma.$transaction([
    prisma.classSubject.updateMany({
      where: { id: { in: classes.map((row) => row.id) } },
      data: { subjectArchivedAt: null },
    }),
    prisma.subjectArchive.delete({ where: { id: archive.id } }),
  ]);
}

export async function deleteArchivedSubject(
  user: SessionUser,
  rawCode: string,
  options: TeacherDeleteOptions = {},
) {
  const schoolId = requireTeacher(user);
  const subjectCode = assertSubjectCode(rawCode);
  const classes = await teacherClassesForSubject(schoolId, user.id, subjectCode);
  const archive = await prisma.subjectArchive.findUnique({
    where: {
      schoolId_teacherId_subjectCode: {
        schoolId,
        teacherId: user.id,
        subjectCode,
      },
    },
  });
  if (!archive) {
    if (classes.length === 0) {
      throw new AppError("Forbidden", 403, "forbidden");
    }
    throw new AppError("請先封存才可刪除。", 400, "not_archived");
  }
  assertTeacherDeleteConfirm({
    confirm: options.confirm,
    expectedToken: subjectCode,
  });
  for (const row of classes) {
    await purgeClassSubject(schoolId, row.id);
  }
  await prisma.subjectArchive.delete({ where: { id: archive.id } });
  await deleteSyllabusIfUnused(schoolId, subjectCode);
}

export async function archiveClass(user: SessionUser, classSubjectId: string) {
  const { cs } = await ownedClass(user, classSubjectId);
  if (cs.subjectArchivedAt) {
    throw new AppError("此科目已封存。請在封存頁處理。", 409, "subject_archived");
  }
  if (!cs.classArchivedAt) {
    await prisma.classSubject.update({
      where: { id: cs.id },
      data: { classArchivedAt: new Date() },
    });
  }
}

export async function restoreClass(user: SessionUser, classSubjectId: string) {
  const { cs } = await ownedClass(user, classSubjectId);
  if (cs.subjectArchivedAt) {
    throw new AppError("此科目已封存。請先在封存頁回復科目。", 409, "subject_archived");
  }
  if (!cs.classArchivedAt) {
    throw new AppError("班別未封存", 400, "not_archived");
  }
  await prisma.classSubject.update({
    where: { id: cs.id },
    data: { classArchivedAt: null },
  });
}

export async function deleteArchivedClass(
  user: SessionUser,
  classSubjectId: string,
  options: TeacherDeleteOptions = {},
) {
  const { schoolId, cs } = await ownedClass(user, classSubjectId);
  if (cs.subjectArchivedAt) {
    throw new AppError("此科目已封存。請在封存頁刪除科目。", 409, "subject_archived");
  }
  if (!cs.classArchivedAt) {
    throw new AppError("請先封存才可刪除。", 400, "not_archived");
  }
  assertTeacherDeleteConfirm({
    confirm: options.confirm,
    expectedToken: cs.name,
  });
  const subjectCode = cs.subjectCode;
  await purgeClassSubject(schoolId, cs.id);
  await deleteSyllabusIfUnused(schoolId, subjectCode);
}

export async function listArchivedSubjects(user: SessionUser) {
  const schoolId = requireTeacher(user);
  const archives = await prisma.subjectArchive.findMany({
    where: { schoolId, teacherId: user.id },
    orderBy: { archivedAt: "desc" },
  });

  const subjects = [];
  for (const archive of archives) {
    const classes = await teacherClassesForSubject(
      schoolId,
      user.id,
      archive.subjectCode,
    );
    const impact = await countTeacherDeleteImpactForSubject(
      schoolId,
      user.id,
      archive.subjectCode,
    );
    subjects.push({
      subjectCode: archive.subjectCode,
      archivedAt: formatArchiveDate(archive.archivedAt),
      examCount: impact.examCount,
      submissionCount: impact.submissionCount,
      classes: classes.map((row) => ({
        id: row.id,
        name: row.name,
        individuallyArchived: row.classArchivedAt != null,
      })),
    });
  }
  return subjects;
}
