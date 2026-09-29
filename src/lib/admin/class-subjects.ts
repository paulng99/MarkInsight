/**
 * Admin-only class / subject archive & delete helpers.
 * Archive is soft (archivedAt); delete removes ClassSubject rows (cascade).
 */

import {
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
  deleteHasProtectedData,
  evaluateBulkDeleteArchivedGuards,
  evaluateDeleteConfirmation,
  evaluateDeleteImpactFreshness,
} from "@/lib/admin/delete-confirm";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertSubjectCode } from "@/lib/subjects/syllabus";
import type { Prisma } from "@prisma/client";

export type AdminDeleteOptions = {
  confirm?: unknown;
  expectedExams?: unknown;
  expectedSubmissions?: unknown;
  expectedClasses?: unknown;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function throwDeleteRejected(): never {
  throw new AppError(
    ADMIN_DELETE_REJECTED_MESSAGE_EN,
    400,
    ADMIN_DELETE_REJECTED_CODE,
  );
}

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

async function countDeleteImpactForClass(
  db: DbClient,
  schoolId: string,
  classSubjectId: string,
): Promise<{
  examCount: number;
  submissionCount: number;
  analysisJobCount: number;
}> {
  const [examCount, submissionCount, analysisJobCount] = await Promise.all([
    db.exam.count({
      where: { schoolId, classSubjectId },
    }),
    db.submission.count({
      where: { schoolId, exam: { classSubjectId } },
    }),
    db.analysisJob.count({
      where: {
        schoolId,
        OR: [
          { exam: { classSubjectId } },
          { submission: { exam: { classSubjectId } } },
        ],
      },
    }),
  ]);
  return { examCount, submissionCount, analysisJobCount };
}

async function countDeleteImpactForSubject(
  db: DbClient,
  schoolId: string,
  subjectCode: string,
): Promise<{
  examCount: number;
  submissionCount: number;
  analysisJobCount: number;
}> {
  const [examCount, submissionCount, analysisJobCount] = await Promise.all([
    db.exam.count({
      where: { schoolId, classSubject: { subjectCode } },
    }),
    db.submission.count({
      where: { schoolId, exam: { classSubject: { subjectCode } } },
    }),
    db.analysisJob.count({
      where: {
        schoolId,
        OR: [
          { exam: { classSubject: { subjectCode } } },
          { submission: { exam: { classSubject: { subjectCode } } } },
        ],
      },
    }),
  ]);
  return { examCount, submissionCount, analysisJobCount };
}

async function countDeleteImpactForArchivedClasses(
  db: DbClient,
  schoolId: string,
): Promise<{
  classCount: number;
  examCount: number;
  submissionCount: number;
}> {
  const archivedWhere = { schoolId, archivedAt: { not: null } } as const;
  const [classCount, examCount, submissionCount] = await Promise.all([
    db.classSubject.count({ where: archivedWhere }),
    db.exam.count({
      where: { schoolId, classSubject: { archivedAt: { not: null } } },
    }),
    db.submission.count({
      where: {
        schoolId,
        exam: { classSubject: { archivedAt: { not: null } } },
      },
    }),
  ]);
  return { classCount, examCount, submissionCount };
}

function assertDeleteGuardsOrThrow(input: {
  confirm: unknown;
  expectedToken: string;
  expectedExams: unknown;
  expectedSubmissions: unknown;
  examCount: number;
  submissionCount: number;
  analysisJobCount: number;
}): void {
  const freshness = evaluateDeleteImpactFreshness({
    expectedExams: input.expectedExams,
    expectedSubmissions: input.expectedSubmissions,
    actualExams: input.examCount,
    actualSubmissions: input.submissionCount,
  });
  if (!freshness.ok) {
    throw new AppError(freshness.error, freshness.status, freshness.code);
  }
  const confirmResult = evaluateDeleteConfirmation({
    confirm: input.confirm,
    expectedToken: input.expectedToken,
    hasProtectedData: deleteHasProtectedData({
      submissionCount: input.submissionCount,
      analysisJobCount: input.analysisJobCount,
      examCount: input.examCount,
    }),
  });
  if (!confirmResult.ok) {
    throw new AppError(
      confirmResult.error,
      confirmResult.status,
      confirmResult.code,
    );
  }
}

export async function deleteClassSubject(
  schoolId: string,
  classSubjectId: string,
  options: AdminDeleteOptions = {},
) {
  await prisma.$transaction(async (tx) => {
    const row = await tx.classSubject.findFirst({
      where: { id: classSubjectId, schoolId },
    });
    if (!row) {
      throwDeleteRejected();
    }
    const impact = await countDeleteImpactForClass(tx, schoolId, classSubjectId);
    assertDeleteGuardsOrThrow({
      confirm: options.confirm,
      expectedToken: row.name,
      expectedExams: options.expectedExams,
      expectedSubmissions: options.expectedSubmissions,
      ...impact,
    });
    await tx.classSubject.delete({ where: { id: classSubjectId } });
  });
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
  options: AdminDeleteOptions = {},
) {
  const subjectCode = assertSubjectCode(subjectCodeRaw);
  const deleted = await prisma.$transaction(async (tx) => {
    const impact = await countDeleteImpactForSubject(tx, schoolId, subjectCode);
    assertDeleteGuardsOrThrow({
      confirm: options.confirm,
      expectedToken: subjectCode,
      expectedExams: options.expectedExams,
      expectedSubmissions: options.expectedSubmissions,
      ...impact,
    });
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
export async function deleteAllArchivedClassSubjects(
  schoolId: string,
  options: AdminDeleteOptions = {},
) {
  const deleted = await prisma.$transaction(async (tx) => {
    const impact = await countDeleteImpactForArchivedClasses(tx, schoolId);
    const guards = evaluateBulkDeleteArchivedGuards({
      confirm: options.confirm,
      expectedClasses: options.expectedClasses,
      expectedExams: options.expectedExams,
      expectedSubmissions: options.expectedSubmissions,
      actualClasses: impact.classCount,
      actualExams: impact.examCount,
      actualSubmissions: impact.submissionCount,
    });
    if (!guards.ok) {
      throw new AppError(guards.error, guards.status, guards.code);
    }

    const archived = await tx.classSubject.findMany({
      where: { schoolId, archivedAt: { not: null } },
      select: { subjectCode: true },
    });
    const codes = [...new Set(archived.map((c) => c.subjectCode))];

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
