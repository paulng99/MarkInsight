/**
 * Subject-level syllabus (shared across classes with the same subjectCode).
 */

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { putObject } from "@/lib/storage";

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function requireSchoolId(user: SessionUser): string {
  if (!user.schoolId) {
    throw new AppError("School context required", 403, "no_school");
  }
  return user.schoolId;
}

const SUBJECT_CODE = /^[A-Za-z0-9._-]{1,32}$/;

export function assertSubjectCode(raw: string): string {
  const code = raw.trim();
  if (!SUBJECT_CODE.test(code)) {
    throw new AppError("Invalid subject code", 400, "invalid_subject");
  }
  return code;
}

async function teacherClasses(user: SessionUser, schoolId: string) {
  return prisma.classSubject.findMany({
    where: {
      schoolId,
      enrollments: { some: { userId: user.id, schoolId, role: "TEACHER" } },
    },
    include: {
      exams: {
        orderBy: { examDate: "desc" },
        include: {
          _count: { select: { assets: true, submissions: true } },
          analysisJobs: {
            where: { kind: "EXAM_STRUCTURE" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ subjectCode: "asc" }, { name: "asc" }],
  });
}

export async function assertTeacherTeachesSubject(
  user: SessionUser,
  subjectCode: string,
) {
  const schoolId = requireSchoolId(user);
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "forbidden");
  }
  const code = assertSubjectCode(subjectCode);
  const match = await prisma.classSubject.findFirst({
    where: {
      schoolId,
      subjectCode: code,
      ...(user.role === "TEACHER"
        ? {
            enrollments: {
              some: { userId: user.id, schoolId, role: "TEACHER" },
            },
          }
        : {}),
    },
  });
  if (!match) {
    throw new AppError("Subject not found", 404, "subject_not_found");
  }
  return { schoolId, subjectCode: code };
}

export async function listTeacherSubjectGroups(user: SessionUser) {
  const schoolId = requireSchoolId(user);
  const classes = await teacherClasses(user, schoolId);
  const codes = [...new Set(classes.map((c) => c.subjectCode))];
  const syllabi = await prisma.subjectSyllabus.findMany({
    where: { schoolId, subjectCode: { in: codes } },
  });
  const syllabusByCode = new Map(syllabi.map((s) => [s.subjectCode, s]));

  const groups = new Map<
    string,
    {
      subjectCode: string;
      syllabus: {
        originalName: string | null;
        mimeType: string | null;
        updatedAt: string;
      } | null;
      classes: Array<{
        id: string;
        name: string;
        gradeLevel: string | null;
        exams: Array<{
          id: string;
          title: string;
          examDate: string;
          assetCount: number;
          submissionCount: number;
          latestStructureJob: { id: string; status: string } | null;
        }>;
      }>;
    }
  >();

  for (const cs of classes) {
    let group = groups.get(cs.subjectCode);
    if (!group) {
      const syllabus = syllabusByCode.get(cs.subjectCode);
      group = {
        subjectCode: cs.subjectCode,
        syllabus: syllabus
          ? {
              originalName: syllabus.originalName,
              mimeType: syllabus.mimeType,
              updatedAt: formatDateYmd(syllabus.updatedAt),
            }
          : null,
        classes: [],
      };
      groups.set(cs.subjectCode, group);
    }
    group.classes.push({
      id: cs.id,
      name: cs.name,
      gradeLevel: cs.gradeLevel,
      exams: cs.exams.map((e) => ({
        id: e.id,
        title: e.title,
        examDate: formatDateYmd(e.examDate),
        assetCount: e._count.assets,
        submissionCount: e._count.submissions,
        latestStructureJob: e.analysisJobs[0]
          ? { id: e.analysisJobs[0].id, status: e.analysisJobs[0].status }
          : null,
      })),
    });
  }

  return [...groups.values()];
}

export async function uploadSubjectSyllabus(input: {
  user: SessionUser;
  subjectCode: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const { schoolId, subjectCode } = await assertTeacherTeachesSubject(
    input.user,
    input.subjectCode,
  );
  const mime = input.mimeType || "application/octet-stream";
  const allowed =
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/");
  if (!allowed) {
    throw new AppError("請檢查檔案 — PDF、圖片或純文字", 400, "unsupported_syllabus");
  }

  const stored = await putObject({
    schoolId,
    examId: `syllabus-${subjectCode}`,
    kind: "SYLLABUS",
    fileName: input.fileName,
    mimeType: mime,
    bytes: input.bytes,
  });

  return prisma.subjectSyllabus.upsert({
    where: { schoolId_subjectCode: { schoolId, subjectCode } },
    create: {
      schoolId,
      subjectCode,
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      originalName: stored.originalName,
      uploadedById: input.user.id,
    },
    update: {
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      originalName: stored.originalName,
      uploadedById: input.user.id,
    },
  });
}

export async function getSubjectSyllabus(schoolId: string, subjectCode: string) {
  return prisma.subjectSyllabus.findUnique({
    where: { schoolId_subjectCode: { schoolId, subjectCode } },
  });
}
