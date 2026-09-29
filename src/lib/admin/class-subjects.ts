/**
 * Admin-only class / subject archive & delete helpers.
 * Archive is soft (archivedAt); delete removes ClassSubject rows (cascade).
 */

import {
  ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
  deleteHasProtectedData,
  evaluateDeleteConfirmation,
  evaluateDeleteImpactFreshness,
  evaluateRequiredExpectedCounts,
} from "@/lib/admin/delete-confirm";
import { buildAdminClassEnrollmentCountSelect } from "@/lib/admin/enrollment-display-count";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertSubjectCode } from "@/lib/subjects/syllabus";
import type { Prisma } from "@prisma/client";

export type AdminDeleteOptions = {
  confirm?: unknown;
  expectedExams?: unknown;
  expectedSubmissions?: unknown;
  expectedAnalysisJobs?: unknown;
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
  /** Submissions under this class's exams. */
  submissionCount: number;
  /** Analysis jobs tied to this class's exams or submissions. */
  analysisJobCount: number;
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
  analysisJobCount: number;
  classes: AdminClassSubjectDto[];
};

async function analysisJobCountsByClassId(
  schoolId: string,
  classIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  for (const id of classIds) counts.set(id, 0);

  const jobs = await prisma.analysisJob.findMany({
    where: {
      schoolId,
      OR: [
        { exam: { classSubjectId: { in: classIds } } },
        { submission: { exam: { classSubjectId: { in: classIds } } } },
      ],
    },
    select: {
      exam: { select: { classSubjectId: true } },
      submission: { select: { exam: { select: { classSubjectId: true } } } },
    },
  });

  for (const job of jobs) {
    const classSubjectId =
      job.exam?.classSubjectId ??
      job.submission?.exam?.classSubjectId ??
      null;
    if (!classSubjectId) continue;
    counts.set(classSubjectId, (counts.get(classSubjectId) ?? 0) + 1);
  }
  return counts;
}

export async function listAdminSubjectGroups(
  schoolId: string,
): Promise<AdminSubjectGroupDto[]> {
  const [classes, syllabi] = await Promise.all([
    prisma.classSubject.findMany({
      where: { schoolId },
      include: {
        schoolYear: { select: { id: true, name: true } },
        // enrollmentCount is STUDENT-only for display; cascade still deletes all roles + pending.
        _count: { select: buildAdminClassEnrollmentCountSelect() },
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

  const analysisByClass = await analysisJobCountsByClassId(
    schoolId,
    classes.map((c) => c.id),
  );

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
        analysisJobCount: 0,
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
      analysisJobCount: analysisByClass.get(cs.id) ?? 0,
    };
    if (cs.archivedAt) group.archivedClassCount += 1;
    else group.activeClassCount += 1;
    group.enrollmentCount += dto.enrollmentCount;
    group.examCount += dto.examCount;
    group.submissionCount += dto.submissionCount;
    group.analysisJobCount += dto.analysisJobCount;
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
        analysisJobCount: 0,
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
  analysisJobCount: number;
}> {
  const archivedWhere = { schoolId, archivedAt: { not: null } } as const;
  const [classCount, examCount, submissionCount, analysisJobCount] =
    await Promise.all([
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
      db.analysisJob.count({
        where: {
          schoolId,
          OR: [
            { exam: { classSubject: { archivedAt: { not: null } } } },
            {
              submission: {
                exam: { classSubject: { archivedAt: { not: null } } },
              },
            },
          ],
        },
      }),
    ]);
  return { classCount, examCount, submissionCount, analysisJobCount };
}

function assertDeleteGuardsOrThrow(input: {
  confirm: unknown;
  expectedToken: string;
  expectedExams: unknown;
  expectedSubmissions: unknown;
  expectedAnalysisJobs: unknown;
  examCount: number;
  submissionCount: number;
  analysisJobCount: number;
}): void {
  const freshness = evaluateDeleteImpactFreshness({
    expectedExams: input.expectedExams,
    expectedSubmissions: input.expectedSubmissions,
    expectedAnalysisJobs: input.expectedAnalysisJobs,
    actualExams: input.examCount,
    actualSubmissions: input.submissionCount,
    actualAnalysisJobs: input.analysisJobCount,
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
  const required = evaluateRequiredExpectedCounts({
    expectedExams: options.expectedExams,
    expectedSubmissions: options.expectedSubmissions,
    expectedAnalysisJobs: options.expectedAnalysisJobs,
  });
  if (!required.ok) {
    throw new AppError(required.error, required.status, required.code);
  }

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
      expectedAnalysisJobs: options.expectedAnalysisJobs,
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
  const required = evaluateRequiredExpectedCounts({
    expectedExams: options.expectedExams,
    expectedSubmissions: options.expectedSubmissions,
    expectedAnalysisJobs: options.expectedAnalysisJobs,
  });
  if (!required.ok) {
    throw new AppError(required.error, required.status, required.code);
  }
  const deleted = await prisma.$transaction(async (tx) => {
    const impact = await countDeleteImpactForSubject(tx, schoolId, subjectCode);
    assertDeleteGuardsOrThrow({
      confirm: options.confirm,
      expectedToken: subjectCode,
      expectedExams: options.expectedExams,
      expectedSubmissions: options.expectedSubmissions,
      expectedAnalysisJobs: options.expectedAnalysisJobs,
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
  // Reject omitted expected* / wrong confirm before opening a DB transaction.
  const fieldsOk = evaluateRequiredExpectedCounts({
    expectedExams: options.expectedExams,
    expectedSubmissions: options.expectedSubmissions,
    expectedAnalysisJobs: options.expectedAnalysisJobs,
    expectedClasses: options.expectedClasses,
    requireClasses: true,
  });
  if (!fieldsOk.ok) {
    throw new AppError(fieldsOk.error, fieldsOk.status, fieldsOk.code);
  }
  const confirmOk = evaluateDeleteConfirmation({
    confirm: options.confirm,
    expectedToken: ADMIN_BULK_DELETE_ARCHIVED_CONFIRM,
    hasProtectedData: true,
    requireConfirm: true,
  });
  if (!confirmOk.ok) {
    throw new AppError(confirmOk.error, confirmOk.status, confirmOk.code);
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const impact = await countDeleteImpactForArchivedClasses(tx, schoolId);
    const freshness = evaluateDeleteImpactFreshness({
      expectedClasses: options.expectedClasses,
      expectedExams: options.expectedExams,
      expectedSubmissions: options.expectedSubmissions,
      expectedAnalysisJobs: options.expectedAnalysisJobs,
      actualClasses: impact.classCount,
      actualExams: impact.examCount,
      actualSubmissions: impact.submissionCount,
      actualAnalysisJobs: impact.analysisJobCount,
      requireClasses: true,
    });
    if (!freshness.ok) {
      throw new AppError(freshness.error, freshness.status, freshness.code);
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
