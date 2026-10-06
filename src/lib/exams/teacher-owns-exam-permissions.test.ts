/**
 * Real permission coverage for assertTeacherOwnsExam + startExamStructureAnalysis.
 * Mocks prisma / school-settings / storage — never the ownership helpers themselves.
 */

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import { AppError } from "../errors.ts";
import type { SessionUser } from "../rbac.ts";

const OWNER: SessionUser = {
  id: "teacher-owner",
  email: "owner@school.edu.hk",
  name: "Owner",
  role: "TEACHER",
  schoolId: "school-1",
};

const OTHER_SAME_SCHOOL: SessionUser = {
  id: "teacher-other",
  email: "other@school.edu.hk",
  name: "Other",
  role: "TEACHER",
  schoolId: "school-1",
};

const OTHER_SCHOOL: SessionUser = {
  id: "teacher-foreign",
  email: "foreign@other.edu.hk",
  name: "Foreign",
  role: "TEACHER",
  schoolId: "school-2",
};

const STUDENT: SessionUser = {
  id: "student-1",
  email: "student@school.edu.hk",
  name: "Student",
  role: "STUDENT",
  schoolId: "school-1",
};

const now = new Date("2026-10-01T00:00:00.000Z");

const examRow = {
  id: "exam-1",
  schoolId: "school-1",
  classSubjectId: "cs-1",
  title: "Midterm",
  examDate: now,
  structureLlmModel: null,
  sourceExamId: null,
  classSubject: {
    id: "cs-1",
    name: "3A",
    schoolId: "school-1",
    subjectCode: "MATH",
    archivedAt: null,
    classArchivedAt: null,
    subjectArchivedAt: null,
    schoolYear: { id: "sy-1", name: "2025-2026" },
  },
  assets: [
    {
      id: "asset-1",
      kind: "QUESTION_PAPER",
      storageKey: "k1",
      createdAt: now,
    },
  ],
  analysisJobs: [] as Array<{
    id: string;
    status: string;
    kind: string;
    updatedAt: Date;
    startedAt: Date | null;
    createdAt: Date;
  }>,
};

const track = {
  jobsCreated: 0,
  enrollments: new Set<string>(["teacher-owner"]),
  activeStructureJob: null as null | {
    id: string;
    status: string;
    updatedAt: Date;
    startedAt: Date | null;
    createdAt: Date;
  },
};

function reset() {
  track.jobsCreated = 0;
  track.enrollments = new Set(["teacher-owner"]);
  track.activeStructureJob = null;
  examRow.analysisJobs = [];
}

const prismaMock = {
  exam: {
    findFirst: async (args: { where?: { id?: string; schoolId?: string } }) => {
      if (args.where?.id !== examRow.id) return null;
      return {
        ...examRow,
        analysisJobs: [...examRow.analysisJobs],
        assets: [...examRow.assets],
        classSubject: { ...examRow.classSubject, schoolYear: { ...examRow.classSubject.schoolYear } },
      };
    },
  },
  enrollment: {
    findFirst: async (args: {
      where?: { userId?: string; classSubjectId?: string; role?: string };
    }) => {
      const userId = args.where?.userId;
      if (
        args.where?.classSubjectId === "cs-1" &&
        args.where?.role === "TEACHER" &&
        userId &&
        track.enrollments.has(userId)
      ) {
        return { id: `enr-${userId}`, userId, role: "TEACHER" };
      }
      return null;
    },
  },
  asset: {
    findMany: async () => examRow.assets,
  },
  analysisJob: {
    findFirst: async (args: {
      where?: { kind?: string; status?: { in?: string[] }; examId?: string };
    }) => {
      if (
        args.where?.kind === "EXAM_STRUCTURE" &&
        track.activeStructureJob &&
        args.where?.status?.in?.includes(track.activeStructureJob.status)
      ) {
        return { ...track.activeStructureJob };
      }
      return null;
    },
    findUnique: async () => ({
      id: "job-pending",
      status: "RUNNING",
      kind: "EXAM_STRUCTURE",
    }),
    findMany: async () => [],
    create: async (args: { data: { id?: string } }) => {
      track.jobsCreated += 1;
      return {
        id: "job-new",
        status: "PENDING",
        kind: "EXAM_STRUCTURE",
        llmModel: "test/model",
        ...args.data,
      };
    },
    update: async () => ({}),
  },
};

(
  globalThis as unknown as { __MI_PRISMA_MOCK__: typeof prismaMock }
).__MI_PRISMA_MOCK__ = prismaMock;

const srcRoot = fileURLToPath(new URL("../../", import.meta.url));

register(
  `data:text/javascript,${encodeURIComponent(`
    import { pathToFileURL } from "node:url";
    import { existsSync } from "node:fs";
    import path from "node:path";

    const root = ${JSON.stringify(srcRoot)};

    export async function resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/prisma") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export const prisma = globalThis.__MI_PRISMA_MOCK__;
            \`),
        };
      }

      if (specifier === "@/lib/school-settings" || specifier === "@/lib/school-settings/index") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export async function resolveAnalysisLlmModelForNewJob() {
                return "test/model";
              }
              export async function ensureSchoolBootstrap() {}
              export async function ensureTeacherWorkspace() {}
            \`),
        };
      }

      if (specifier === "@/lib/subjects/syllabus") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export async function getSubjectSyllabus() { return null; }
              export function assertSubjectCode(code) { return String(code).trim(); }
            \`),
        };
      }

      if (specifier === "@/lib/llm" || specifier === "@/lib/llm/index") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export function createLlmClient() {
                return {
                  analyzeExamStructure: async () => {
                    throw new Error("llm mock");
                  },
                  scoreSubmission: async () => {
                    throw new Error("llm mock");
                  },
                  snapshotUsage: () => ({
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    costUsd: null,
                    costComplete: true,
                    callCount: 0,
                  }),
                };
              }
            \`),
        };
      }

      if (specifier === "@/lib/aggregates/weakness") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export async function refreshSubjectAggregates() {}
            \`),
        };
      }

      if (specifier === "@/lib/storage") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export async function deleteObject() {}
              export async function putObject() {
                return { storageKey: "k", mimeType: "application/pdf", originalName: "x.pdf" };
              }
            \`),
        };
      }

      if (specifier.startsWith("@/")) {
        const rel = specifier.slice(2);
        const candidates = [
          path.join(root, rel + ".ts"),
          path.join(root, rel + ".tsx"),
          path.join(root, rel, "index.ts"),
        ];
        for (const file of candidates) {
          if (existsSync(file)) {
            return nextResolve(pathToFileURL(file).href, context);
          }
        }
      }

      if (specifier.startsWith(".") && !/\\.[a-zA-Z0-9]+$/.test(specifier)) {
        try {
          return await nextResolve(specifier + ".ts", context);
        } catch {
          return nextResolve(specifier, context);
        }
      }

      return nextResolve(specifier, context);
    }
  `)}`,
  pathToFileURL("./"),
);

const {
  assertTeacherOwnsExam,
  startExamStructureAnalysis,
} = await import("./service.ts");

beforeEach(() => {
  reset();
});

async function expectAppError(
  promise: Promise<unknown>,
  status: number,
  code?: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, status);
    if (code) assert.equal(error.code, code);
    return true;
  });
}

test("assertTeacherOwnsExam: owning teacher succeeds", async () => {
  const exam = await assertTeacherOwnsExam(OWNER, "exam-1");
  assert.equal(exam.id, "exam-1");
});

test("assertTeacherOwnsExam: same-school teacher not enrolled gets 403", async () => {
  await expectAppError(
    assertTeacherOwnsExam(OTHER_SAME_SCHOOL, "exam-1"),
    403,
    "forbidden",
  );
});

test("assertTeacherOwnsExam: other-school teacher gets 403", async () => {
  await expectAppError(
    assertTeacherOwnsExam(OTHER_SCHOOL, "exam-1"),
    403,
    "forbidden",
  );
});

test("assertTeacherOwnsExam: student gets 403", async () => {
  await expectAppError(assertTeacherOwnsExam(STUDENT, "exam-1"), 403, "forbidden");
});

test("startExamStructureAnalysis: owning teacher succeeds", async () => {
  const result = await startExamStructureAnalysis(OWNER, "exam-1");
  assert.equal(result.jobId, "job-new");
  assert.equal(track.jobsCreated, 1);
});

test("startExamStructureAnalysis: same-school teacher not enrolled gets 403", async () => {
  await expectAppError(
    startExamStructureAnalysis(OTHER_SAME_SCHOOL, "exam-1"),
    403,
    "forbidden",
  );
  assert.equal(track.jobsCreated, 0);
});

test("startExamStructureAnalysis: other-school teacher gets 403", async () => {
  await expectAppError(
    startExamStructureAnalysis(OTHER_SCHOOL, "exam-1"),
    403,
    "forbidden",
  );
  assert.equal(track.jobsCreated, 0);
});

test("startExamStructureAnalysis: student gets 403", async () => {
  await expectAppError(
    startExamStructureAnalysis(STUDENT, "exam-1"),
    403,
    "forbidden",
  );
  assert.equal(track.jobsCreated, 0);
});

test("startExamStructureAnalysis: rejects when an active structure job exists", async () => {
  track.activeStructureJob = {
    id: "job-active",
    status: "RUNNING",
    updatedAt: new Date(),
    startedAt: new Date(),
    createdAt: new Date(),
  };
  await expectAppError(
    startExamStructureAnalysis(OWNER, "exam-1"),
    409,
    "analysis_in_progress",
  );
  assert.equal(track.jobsCreated, 0);
});
