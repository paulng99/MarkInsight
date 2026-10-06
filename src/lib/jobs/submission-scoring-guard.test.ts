/**
 * Concurrent submission-scoring enqueue guard (real enqueueAnalyzeSubmission).
 * Mocks prisma + school-settings only.
 */

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import { AppError } from "../errors.ts";

const track = {
  jobsCreated: 0,
  active: null as null | {
    id: string;
    status: string;
    updatedAt: Date;
    startedAt: Date | null;
    createdAt: Date;
  },
};

function reset() {
  track.jobsCreated = 0;
  track.active = null;
}

const prismaMock = {
  submission: {
    findFirst: async () => ({
      id: "sub-1",
      examId: "exam-1",
      schoolId: "school-1",
      assetId: "asset-1",
    }),
    update: async () => ({}),
  },
  analysisJob: {
    findFirst: async (args: {
      where?: { kind?: string; status?: { in?: string[] }; submissionId?: string };
    }) => {
      if (
        args.where?.kind === "SUBMISSION_SCORING" &&
        args.where?.submissionId === "sub-1" &&
        track.active &&
        args.where?.status?.in?.includes(track.active.status)
      ) {
        return { ...track.active };
      }
      return null;
    },
    findUnique: async () => ({
      id: "job-x",
      status: "RUNNING",
      kind: "SUBMISSION_SCORING",
    }),
    findMany: async () => [],
    create: async (args: { data: Record<string, unknown> }) => {
      track.jobsCreated += 1;
      return {
        id: "job-new",
        status: "PENDING",
        kind: "SUBMISSION_SCORING",
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

const { enqueueAnalyzeSubmission } = await import("./analyze-exam.ts");

beforeEach(() => {
  reset();
});

test("enqueueAnalyzeSubmission succeeds when no active scoring job", async () => {
  const result = await enqueueAnalyzeSubmission({
    schoolId: "school-1",
    examId: "exam-1",
    submissionId: "sub-1",
    requestedByUserId: "student-1",
  });
  assert.equal(result.jobId, "job-new");
  assert.equal(track.jobsCreated, 1);
});

test("enqueueAnalyzeSubmission rejects with 409 while PENDING scoring job is active", async () => {
  track.active = {
    id: "job-active",
    status: "PENDING",
    updatedAt: new Date(),
    startedAt: null,
    createdAt: new Date(),
  };
  await assert.rejects(
    enqueueAnalyzeSubmission({
      schoolId: "school-1",
      examId: "exam-1",
      submissionId: "sub-1",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "analysis_in_progress");
      return true;
    },
  );
  assert.equal(track.jobsCreated, 0);
});

test("enqueueAnalyzeSubmission rejects with 409 while RUNNING scoring job is active", async () => {
  track.active = {
    id: "job-active",
    status: "RUNNING",
    updatedAt: new Date(),
    startedAt: new Date(),
    createdAt: new Date(),
  };
  await assert.rejects(
    enqueueAnalyzeSubmission({
      schoolId: "school-1",
      examId: "exam-1",
      submissionId: "sub-1",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "analysis_in_progress");
      return true;
    },
  );
  assert.equal(track.jobsCreated, 0);
});
