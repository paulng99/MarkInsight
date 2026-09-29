/**
 * Admin-only class / subject archive & delete helpers.
 * Archive is soft (archivedAt); delete removes ClassSubject rows (cascade).
 */

import {
  deleteHasProtectedData,
  evaluateDeleteConfirmation,
} from "@/lib/admin/delete-confirm";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertSubjectCode } from "@/lib/subjects/syllabus";

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type AdminClassSubjectDto = {
  id: string;
  name: string;
  subjectCode: string;
  gradeLevel: string | null;
  schoolYearId: string;
  schoolYearName: string;
  archivedAt: string | null;
  enrollmentCount: number;
  examCount: number;
  /** Submissions (and thus analysis results) under this class's exams. */
  submissionCount: number;
};

export type AdminSubjectGroupDto = {
  subjectCode: string;
  hasSyllabus: boolean;
  syllabusOriginalName: string | null;
  activeClassCount: number;
  archivedClassCount: number;
  enrollmentCount: number;
  examCount: number;
  submissionCount: number;
  classes: AdminClassSubjectDto[];
};

export async function listAdminSubjectGroups(
  schoolId: string,
): Promise<AdminSubjectGroupDto[]> {
  const [classes, syllabi] = await Promise.all([
    prisma.classSubject.findMany({
      where: { schoolId },
      include: {
        schoolYear: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, exams: true } },
        exams: {
          select: { _count: { select: { submissions: true } } },
        },
      },
      orderBy: [{ subjectCode: "asc" }, { name: "asc" }],
    }),
    prisma.subjectSyllabus.findMany({
      where: { schoolId },
      select: { subjectCode: true, originalName: true },
    }),
  ]);

  const syllabusByCode = new Map(
    syllabi.map((s) => [s.subjectCode, s.originalName ?? null]),
  );

  const groups = new Map<string, AdminSubjectGroupDto>();

  for (const cs of classes) {
    let group = groups.get(cs.subjectCode);
    if (!group) {
      const syllabusName = syllabusByCode.get(cs.subjectCode);
      group = {
        subjectCode: cs.subjectCode,
        hasSyllabus: syllabusByCode.has(cs.subjectCode),
        syllabusOriginalName: syllabusName ?? null,
        activeClassCount: 0,
        archivedClassCount: 0,
        enrollmentCount: 0,
        examCount: 0,
        submissionCount: 0,
        classes: [],
      };
      groups.set(cs.subjectCode, group);
    }
    const submissionCount = cs.exams.reduce(
      (n, exam) => n + exam._count.submissions,
      0,
    );
    const dto: AdminClassSubjectDto = {
      id: cs.id,
      name: cs.name,
      subjectCode: cs.subjectCode,
      gradeLevel: cs.gradeLevel,
      schoolYearId: cs.schoolYear.id,
      schoolYearName: cs.schoolYear.name,
      archivedAt: cs.archivedAt ? formatDateYmd(cs.archivedAt) : null,
      enrollmentCount: cs._count.enrollments,
      examCount: cs._count.exams,
      submissionCount,
    };
    if (cs.archivedAt) group.archivedClassCount += 1;
    else group.activeClassCount += 1;
    group.enrollmentCount += dto.enrollmentCount;
    group.examCount += dto.examCount;
    group.submissionCount += dto.submissionCount;
    group.classes.push(dto);
  }

  // Subjects that only have a syllabus (no classes left) still appear once.
  for (const [code, name] of syllabusByCode) {
    if (!groups.has(code)) {
      groups.set(code, {
        subjectCode: code,
        hasSyllabus: true,
        syllabusOriginalName: name,
        activeClassCount: 0,
        archivedClassCount: 0,
        enrollmentCount: 0,
        examCount: 0,
        submissionCount: 0,
        classes: [],
      });
    }
  }

  return [...groups.values()].sort((a, b) =>
    a.subjectCode.localeCompare(b.subjectCode),
  );
}

async function requireClassInSchool(schoolId: string, classSubjectId: string) {
  const row = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
  });
  if (!row) {
    throw new AppError("Class not found", 404, "class_not_found");
  }
  return row;
}

export async function setClassArchived(
  schoolId: string,
  classSubjectId: string,
  archived: boolean,
) {
  await requireClassInSchool(schoolId, classSubjectId);
  return prisma.classSubject.update({
    where: { id: classSubjectId },
    data: { archivedAt: archived ? new Date() : null },
  });
}

async function countProtectedDataForClass(
  schoolId: string,
  classSubjectId: string,
): Promise<{ submissionCount: number; analysisJobCount: number }> {
  const [submissionCount, analysisJobCount] = await Promise.all([
    prisma.submission.count({
      where: { schoolId, exam: { classSubjectId } },
    }),
    prisma.analysisJob.count({
      where: {
        schoolId,
        OR: [
          { exam: { classSubjectId } },
          { submission: { exam: { classSubjectId } } },
        ],
      },
    }),
  ]);
  return { submissionCount, analysisJobCount };
}

async function countProtectedDataForSubject(
  schoolId: string,
  subjectCode: string,
): Promise<{ submissionCount: number; analysisJobCount: number }> {
  const [submissionCount, analysisJobCount] = await Promise.all([
    prisma.submission.count({
      where: { schoolId, exam: { classSubject: { subjectCode } } },
    }),
    prisma.analysisJob.count({
      where: {
        schoolId,
        OR: [
          { exam: { classSubject: { subjectCode } } },
          { submission: { exam: { classSubject: { subjectCode } } } },
        ],
      },
    }),
  ]);
  return { submissionCount, analysisJobCount };
}

function assertDeleteConfirmOrThrow(
  confirm: unknown,
  expectedToken: string,
  hasProtectedData: boolean,
): void {
  const result = evaluateDeleteConfirmation({
    confirm,
    expectedToken,
    hasProtectedData,
  });
  if (!result.ok) {
    throw new AppError(result.error, result.status, result.code);
  }
}

export async function deleteClassSubject(
  schoolId: string,
  classSubjectId: string,
  confirm?: unknown,
) {
  const row = await requireClassInSchool(schoolId, classSubjectId);
  const protectedCounts = await countProtectedDataForClass(
    schoolId,
    classSubjectId,
  );
  assertDeleteConfirmOrThrow(
    confirm,
    row.name,
    deleteHasProtectedData(protectedCounts),
  );
  await prisma.classSubject.delete({ where: { id: classSubjectId } });
}

export async function setSubjectArchived(
  schoolId: string,
  subjectCodeRaw: string,
  archived: boolean,
) {
  const subjectCode = assertSubjectCode(subjectCodeRaw);
  const result = await prisma.classSubject.updateMany({
    where: {
      schoolId,
      subjectCode,
      archivedAt: archived ? null : { not: null },
    },
    data: { archivedAt: archived ? new Date() : null },
  });
  return { subjectCode, updated: result.count };
}

export async function deleteSubject(
  schoolId: string,
  subjectCodeRaw: string,
  confirm?: unknown,
) {
  const subjectCode = assertSubjectCode(subjectCodeRaw);
  const protectedCounts = await countProtectedDataForSubject(
    schoolId,
    subjectCode,
  );
  assertDeleteConfirmOrThrow(
    confirm,
    subjectCode,
    deleteHasProtectedData(protectedCounts),
  );
  const deleted = await prisma.$transaction(async (tx) => {
    const removed = await tx.classSubject.deleteMany({
      where: { schoolId, subjectCode },
    });
    await tx.subjectSyllabus.deleteMany({
      where: { schoolId, subjectCode },
    });
    return removed.count;
  });
  return { subjectCode, deleted };
}

/** Archive every active class in the school. */
export async function archiveAllClassSubjects(schoolId: string) {
  const result = await prisma.classSubject.updateMany({
    where: { schoolId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return { updated: result.count };
}

/** Permanently delete every archived class in the school. */
export async function deleteAllArchivedClassSubjects(schoolId: string) {
  const archived = await prisma.classSubject.findMany({
    where: { schoolId, archivedAt: { not: null } },
    select: { subjectCode: true },
  });
  const codes = [...new Set(archived.map((c) => c.subjectCode))];

  const deleted = await prisma.$transaction(async (tx) => {
    const removed = await tx.classSubject.deleteMany({
      where: { schoolId, archivedAt: { not: null } },
    });
    for (const subjectCode of codes) {
      const remaining = await tx.classSubject.count({
        where: { schoolId, subjectCode },
      });
      if (remaining === 0) {
        await tx.subjectSyllabus.deleteMany({
          where: { schoolId, subjectCode },
        });
      }
    }
    return removed.count;
  });
  return { deleted };
}
