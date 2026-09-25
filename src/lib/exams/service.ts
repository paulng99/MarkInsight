/**
 * Exam / submission domain helpers with schoolId + enrollment RBAC.
 */

import type { AssetKind, Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { putObject } from "@/lib/storage";
import {
  enqueueAnalyzeExam,
  enqueueAnalyzeSubmission,
} from "@/lib/jobs/analyze-exam";

export function requireSchoolId(user: SessionUser): string {
  if (!user.schoolId) {
    throw new AppError("School context required", 403, "no_school");
  }
  return user.schoolId;
}

export async function assertTeacherOwnsClass(
  user: SessionUser,
  classSubjectId: string,
): Promise<{ schoolId: string; classSubjectId: string }> {
  const schoolId = requireSchoolId(user);
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      classSubjectId,
      userId: user.id,
      schoolId,
      role: "TEACHER",
    },
  });
  // Demo admin may not be enrolled — allow ADMIN same-school only for read helpers.
  if (!enrollment && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const cs = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
  });
  if (!cs) {
    throw new AppError("Class not found", 404, "class_not_found");
  }
  return { schoolId, classSubjectId };
}

export async function assertTeacherOwnsExam(
  user: SessionUser,
  examId: string,
) {
  const schoolId = requireSchoolId(user);
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: {
      classSubject: { include: { schoolYear: true } },
      assets: { orderBy: { createdAt: "desc" } },
      analysisJobs: {
        where: { kind: "EXAM_STRUCTURE" },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  if (!exam) {
    throw new AppError("Exam not found", 404, "exam_not_found");
  }
  if (user.role === "TEACHER") {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        classSubjectId: exam.classSubjectId,
        userId: user.id,
        schoolId,
        role: "TEACHER",
      },
    });
    if (!enrollment) {
      throw new AppError("Forbidden", 403, "forbidden");
    }
  } else if (user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  return exam;
}

/** Copy a prepared paper onto other classes of the same subject. */
export async function distributeExamToClasses(
  user: SessionUser,
  examId: string,
  classSubjectIds: string[],
) {
  const exam = await assertTeacherOwnsExam(user, examId);
  const sourceId = exam.sourceExamId ?? exam.id;
  const source =
    sourceId === exam.id
      ? exam
      : await assertTeacherOwnsExam(user, sourceId);
  const targets = [...new Set(classSubjectIds.filter(Boolean))];
  if (targets.length === 0) {
    throw new AppError("請選擇班別", 400, "class_required");
  }

  const created: Array<{ id: string; classSubjectId: string; title: string }> = [];
  for (const classSubjectId of targets) {
    await assertTeacherOwnsClass(user, classSubjectId);
    const target = await prisma.classSubject.findFirst({
      where: { id: classSubjectId, schoolId: source.schoolId },
    });
    if (!target || target.subjectCode !== source.classSubject.subjectCode) {
      throw new AppError("只能分發到同一科目的班別", 400, "subject_mismatch");
    }
    if (target.id === source.classSubjectId) continue;

    const existing = await prisma.exam.findFirst({
      where: { schoolId: source.schoolId, sourceExamId: source.id, classSubjectId: target.id },
    });
    if (existing) {
      created.push({
        id: existing.id,
        classSubjectId: existing.classSubjectId,
        title: existing.title,
      });
      continue;
    }

    const copy = await prisma.exam.create({
      data: {
        schoolId: source.schoolId,
        classSubjectId: target.id,
        title: source.title,
        examDate: source.examDate,
        createdById: user.id,
        structureLlmModel: source.structureLlmModel,
        sourceExamId: source.id,
      },
    });
    const papers = await prisma.asset.findMany({
      where: {
        examId: source.id,
        kind: { in: ["QUESTION_PAPER", "ANSWER_KEY", "OTHER"] },
      },
    });
    if (papers.length > 0) {
      await prisma.asset.createMany({
        data: papers.map((a) => ({
          schoolId: source.schoolId,
          examId: copy.id,
          kind: a.kind,
          storageKey: a.storageKey,
          mimeType: a.mimeType,
          originalName: a.originalName,
          uploadedById: user.id,
        })),
      });
    }
    await copyExamStructure(source.id, copy.id);
    created.push({ id: copy.id, classSubjectId: copy.classSubjectId, title: copy.title });
  }

  if (created.length === 0) {
    throw new AppError("所選班別已有這份試卷", 400, "already_distributed");
  }
  return created;
}

async function copyExamStructure(fromExamId: string, toExamId: string) {
  const { copyFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const dir = path.join(process.cwd(), ".data", "exam-structure");
  const from = path.join(dir, `${fromExamId}.json`);
  const to = path.join(dir, `${toExamId}.json`);
  try {
    await mkdir(dir, { recursive: true });
    await copyFile(from, to);
  } catch {
    // Source paper may not have a structure analysis yet.
  }
}

export async function assertStudentOwnsSubmission(
  user: SessionUser,
  submissionId: string,
) {
  const schoolId = requireSchoolId(user);
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, schoolId },
    include: {
      questionScores: { orderBy: { questionKey: "asc" } },
      analysisJobs: { orderBy: { createdAt: "desc" }, take: 5 },
      exam: { include: { classSubject: true } },
      asset: true,
      student: { select: { id: true, name: true, email: true } },
    },
  });
  if (!submission) {
    throw new AppError("Submission not found", 404, "submission_not_found");
  }
  if (user.role === "STUDENT" && submission.studentId !== user.id) {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  if (user.role === "TEACHER") {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        classSubjectId: submission.exam.classSubjectId,
        userId: user.id,
        schoolId,
        role: "TEACHER",
      },
    });
    if (!enrollment) {
      throw new AppError("Forbidden", 403, "forbidden");
    }
  }
  return submission;
}

export async function listExamsForTeacher(user: SessionUser) {
  const schoolId = requireSchoolId(user);
  const classIds = (
    await prisma.enrollment.findMany({
      where: { userId: user.id, schoolId, role: "TEACHER" },
      select: { classSubjectId: true },
    })
  ).map((e) => e.classSubjectId);

  return prisma.exam.findMany({
    where: { schoolId, classSubjectId: { in: classIds } },
    include: {
      classSubject: { select: { id: true, name: true, subjectCode: true } },
      _count: { select: { submissions: true, assets: true } },
      analysisJobs: {
        where: { kind: "EXAM_STRUCTURE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { examDate: "desc" },
  });
}

export async function listExamsForStudent(user: SessionUser) {
  const schoolId = requireSchoolId(user);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, schoolId, role: "STUDENT" },
    select: { id: true, classSubjectId: true },
  });
  const classIds = enrollments.map((e) => e.classSubjectId);
  const exams = await prisma.exam.findMany({
    where: { schoolId, classSubjectId: { in: classIds } },
    include: {
      classSubject: { select: { id: true, name: true, subjectCode: true } },
      submissions: {
        where: { studentId: user.id },
        include: {
          analysisJobs: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { examDate: "desc" },
  });
  return exams;
}

function parseExamDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) {
    throw new AppError("examDate must be yyyy-mm-dd", 400, "invalid_date");
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export async function createExam(
  user: SessionUser,
  input: { classSubjectId: string; title: string; examDate: string },
) {
  const { schoolId } = await assertTeacherOwnsClass(user, input.classSubjectId);
  const title = input.title.trim();
  if (!title) {
    throw new AppError("Title is required", 400, "title_required");
  }
  const examDate = parseExamDate(input.examDate);
  return prisma.exam.create({
    data: {
      schoolId,
      classSubjectId: input.classSubjectId,
      title,
      examDate,
      createdById: user.id,
    },
  });
}

export async function uploadExamAsset(
  user: SessionUser,
  examId: string,
  input: {
    kind: AssetKind;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  },
) {
  const exam = await assertTeacherOwnsExam(user, examId);
  if (
    input.kind !== "QUESTION_PAPER" &&
    input.kind !== "ANSWER_KEY" &&
    input.kind !== "OTHER"
  ) {
    throw new AppError("Invalid asset kind", 400, "invalid_kind");
  }

  const stored = await putObject({
    schoolId: exam.schoolId,
    schoolYear: exam.classSubject.schoolYear.name,
    subjectCode: exam.classSubject.subjectCode,
    className: exam.classSubject.name,
    examDate: formatDateYmd(exam.examDate),
    examTitle: exam.title,
    kind: input.kind,
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });

  return prisma.asset.create({
    data: {
      schoolId: exam.schoolId,
      examId,
      kind: input.kind,
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      originalName: stored.originalName,
      uploadedById: user.id,
    },
  });
}

export async function startExamStructureAnalysis(
  user: SessionUser,
  examId: string,
) {
  const exam = await assertTeacherOwnsExam(user, examId);
  return enqueueAnalyzeExam({
    schoolId: exam.schoolId,
    examId,
    requestedByUserId: user.id,
  });
}

export async function listClassStudentsForExam(
  user: SessionUser,
  examId: string,
) {
  const exam = await assertTeacherOwnsExam(user, examId);
  return prisma.enrollment.findMany({
    where: {
      classSubjectId: exam.classSubjectId,
      schoolId: exam.schoolId,
      role: "STUDENT",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      submissions: {
        where: { examId },
        select: { id: true, status: true },
      },
    },
    orderBy: { user: { email: "asc" } },
  });
}

export async function uploadSubmissionScript(input: {
  actor: SessionUser;
  examId: string;
  /** Target student — required for teacher proxy; ignored for student self-upload. */
  studentId?: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  startAnalysis?: boolean;
}) {
  const { actor, examId } = input;
  const schoolId = requireSchoolId(actor);

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: { classSubject: { include: { schoolYear: true } } },
  });
  if (!exam) {
    throw new AppError("Exam not found", 404, "exam_not_found");
  }

  let studentId = actor.id;
  if (actor.role === "TEACHER") {
    const settings = await prisma.schoolSettings.findUnique({
      where: { schoolId },
    });
    if (!settings?.allowTeacherUploadOnBehalf) {
      throw new AppError(
        "Teacher upload on behalf is disabled for this school",
        403,
        "proxy_upload_disabled",
      );
    }
    await assertTeacherOwnsExam(actor, examId);
    if (!input.studentId) {
      throw new AppError("studentId is required", 400, "student_required");
    }
    studentId = input.studentId;
  } else if (actor.role === "STUDENT") {
    studentId = actor.id;
  } else {
    throw new AppError("Forbidden", 403, "forbidden");
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      classSubjectId: exam.classSubjectId,
      userId: studentId,
      schoolId,
      role: "STUDENT",
    },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!enrollment) {
    throw new AppError("Student is not in this class", 404, "not_enrolled");
  }

  if (actor.role === "STUDENT" && enrollment.userId !== actor.id) {
    throw new AppError("Forbidden", 403, "forbidden");
  }

  const studentLabel =
    enrollment.user.name?.trim() ||
    enrollment.user.email.split("@")[0] ||
    studentId;
  const stored = await putObject({
    schoolId,
    schoolYear: exam.classSubject.schoolYear.name,
    subjectCode: exam.classSubject.subjectCode,
    className: exam.classSubject.name,
    examDate: formatDateYmd(exam.examDate),
    examTitle: exam.title,
    studentName: studentLabel,
    kind: "STUDENT_SCRIPT",
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });

  const asset = await prisma.asset.create({
    data: {
      schoolId,
      examId,
      kind: "STUDENT_SCRIPT",
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      originalName: stored.originalName,
      uploadedById: actor.id,
    },
  });

  const submission = await prisma.submission.upsert({
    where: {
      examId_enrollmentId: {
        examId,
        enrollmentId: enrollment.id,
      },
    },
    create: {
      schoolId,
      examId,
      enrollmentId: enrollment.id,
      studentId,
      assetId: asset.id,
      status: "PENDING",
      errorMessage: null,
    },
    update: {
      assetId: asset.id,
      status: "PENDING",
      errorMessage: null,
      analyzedAt: null,
      scoringLlmModel: null,
    },
  });

  let job = null;
  if (input.startAnalysis !== false) {
    job = await enqueueAnalyzeSubmission({
      schoolId,
      examId,
      submissionId: submission.id,
      requestedByUserId: actor.id,
    });
  }

  return { submission, asset, job };
}

export async function getJobForUser(user: SessionUser, jobId: string) {
  const schoolId = requireSchoolId(user);
  const job = await prisma.analysisJob.findFirst({
    where: { id: jobId, schoolId },
  });
  if (!job) {
    throw new AppError("Job not found", 404, "job_not_found");
  }

  if (user.role === "STUDENT") {
    if (job.submissionId) {
      const sub = await prisma.submission.findFirst({
        where: { id: job.submissionId, studentId: user.id, schoolId },
      });
      if (!sub) throw new AppError("Forbidden", 403, "forbidden");
    } else {
      throw new AppError("Forbidden", 403, "forbidden");
    }
  }

  if (user.role === "TEACHER" && job.examId) {
    await assertTeacherOwnsExam(user, job.examId);
  }

  return job;
}

export function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type { Role };
