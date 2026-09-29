/**
 * Wired coverage for admin class-subject delete guards and list enrollment counts.
 * Mocks `@/lib/prisma` so confirm checks and STUDENT filters are actually exercised
 * (without a live database, unmocked paths collapse into opaque 400s).
 */

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import {
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
} from "./delete-confirm.ts";

type Track = {
  transactionCalls: number;
  classDeleteCalls: number;
  classDeleteManyCalls: number;
  syllabusDeleteManyCalls: number;
};

const track: Track = {
  transactionCalls: 0,
  classDeleteCalls: 0,
  classDeleteManyCalls: 0,
  syllabusDeleteManyCalls: 0,
};

function resetTrack() {
  track.transactionCalls = 0;
  track.classDeleteCalls = 0;
  track.classDeleteManyCalls = 0;
  track.syllabusDeleteManyCalls = 0;
}

/** Mock DB: 2 STUDENT + 3 TEACHER enrollments on one class. */
const STUDENT_ENROLLMENT_COUNT = 2;
const ALL_ENROLLMENT_COUNT = 5;

function createTx() {
  return {
    classSubject: {
      findFirst: async () => ({
        id: "cls_1",
        name: "3A",
        schoolId: "school_a",
        subjectCode: "MATH",
        archivedAt: new Date("2025-01-15T00:00:00.000Z"),
      }),
      findMany: async () => [{ subjectCode: "MATH" }],
      delete: async () => {
        track.classDeleteCalls += 1;
        return { id: "cls_1" };
      },
      deleteMany: async () => {
        track.classDeleteManyCalls += 1;
        return { count: 1 };
      },
      count: async () => 1,
    },
    exam: {
      count: async () => 1,
    },
    submission: {
      count: async () => 0,
    },
    analysisJob: {
      count: async () => 0,
    },
    subjectSyllabus: {
      deleteMany: async () => {
        track.syllabusDeleteManyCalls += 1;
        return { count: 0 };
      },
    },
  };
}

function studentOnlyFromCountSelect(enrollmentsSelect: unknown): boolean {
  return (
    typeof enrollmentsSelect === "object" &&
    enrollmentsSelect !== null &&
    (enrollmentsSelect as { where?: { role?: string } }).where?.role ===
      "STUDENT"
  );
}

const prismaMock = {
  $transaction: async <T>(fn: (tx: ReturnType<typeof createTx>) => Promise<T>) => {
    track.transactionCalls += 1;
    return fn(createTx());
  },
  classSubject: {
    findMany: async (args: {
      include?: {
        _count?: {
          select?: {
            enrollments?: unknown;
          };
        };
      };
    }) => {
      const studentOnly = studentOnlyFromCountSelect(
        args?.include?._count?.select?.enrollments,
      );
      return [
        {
          id: "cls_1",
          name: "3A",
          subjectCode: "MATH",
          gradeLevel: "S3",
          schoolId: "school_a",
          schoolYearId: "sy_1",
          archivedAt: null,
          schoolYear: { id: "sy_1", name: "2025-2026" },
          _count: {
            enrollments: studentOnly
              ? STUDENT_ENROLLMENT_COUNT
              : ALL_ENROLLMENT_COUNT,
            exams: 0,
          },
          exams: [],
        },
      ];
    },
  },
  subjectSyllabus: {
    findMany: async () => [],
  },
  analysisJob: {
    findMany: async () => [],
  },
};

(
  globalThis as unknown as {
    __MI_PRISMA_MOCK__: typeof prismaMock;
  }
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
  deleteAllArchivedClassSubjects,
  deleteClassSubject,
  listAdminSubjectGroups,
} = await import("./class-subjects.ts");

beforeEach(() => {
  resetTrack();
});

test("wired bulk delete_archived: wrong confirm yields delete_rejected and never opens a transaction", async () => {
  await assert.rejects(
    () =>
      deleteAllArchivedClassSubjects("school_a", {
        confirm: "DELETE",
        expectedClasses: 1,
        expectedExams: 1,
        expectedSubmissions: 0,
        expectedAnalysisJobs: 0,
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === ADMIN_DELETE_REJECTED_CODE &&
      error.message === ADMIN_DELETE_REJECTED_MESSAGE_EN,
  );

  assert.equal(track.transactionCalls, 0);
  assert.equal(track.classDeleteManyCalls, 0);
  assert.equal(track.syllabusDeleteManyCalls, 0);
});

test("wired single deleteClassSubject: wrong confirm yields delete_rejected and never deletes", async () => {
  await assert.rejects(
    () =>
      deleteClassSubject("school_a", "cls_1", {
        confirm: "WRONG",
        expectedExams: 1,
        expectedSubmissions: 0,
        expectedAnalysisJobs: 0,
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as { code?: string }).code === ADMIN_DELETE_REJECTED_CODE &&
      error.message === ADMIN_DELETE_REJECTED_MESSAGE_EN,
  );

  // Transaction opens for recount, but the row must not be deleted.
  assert.equal(track.transactionCalls, 1);
  assert.equal(track.classDeleteCalls, 0);
  assert.equal(track.classDeleteManyCalls, 0);
});

test("wired listAdminSubjectGroups: enrollmentCount counts STUDENT only", async () => {
  const groups = await listAdminSubjectGroups("school_a");
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.enrollmentCount, STUDENT_ENROLLMENT_COUNT);
  assert.equal(groups[0]?.classes[0]?.enrollmentCount, STUDENT_ENROLLMENT_COUNT);
  assert.notEqual(groups[0]?.enrollmentCount, ALL_ENROLLMENT_COUNT);
});
