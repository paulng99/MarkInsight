/**
 * Real permission + confirm coverage for teacher permanent delete.
 * Mocks `@/lib/prisma` and storage only — never the ownership / confirm helpers.
 */

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import { AppError } from "../errors.ts";
import type { SessionUser } from "../rbac.ts";

type ClassRow = {
  id: string;
  name: string;
  schoolId: string;
  subjectCode: string;
  classArchivedAt: Date | null;
  subjectArchivedAt: Date | null;
  archivedAt: Date | null;
};

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

const archivedClass: ClassRow = {
  id: "cs-1",
  name: "3A",
  schoolId: "school-1",
  subjectCode: "MATH",
  classArchivedAt: new Date("2026-09-01T00:00:00.000Z"),
  subjectArchivedAt: null,
  archivedAt: null,
};

const track = {
  classDeletes: 0,
  subjectArchiveDeletes: 0,
};

const state = {
  enrollments: new Set<string>(["teacher-owner"]),
  subjectArchiveOwnerId: "teacher-owner" as string | null,
  subjectClassesForOwner: [archivedClass] as ClassRow[],
};

function resetState() {
  track.classDeletes = 0;
  track.subjectArchiveDeletes = 0;
  state.enrollments = new Set(["teacher-owner"]);
  state.subjectArchiveOwnerId = "teacher-owner";
  state.subjectClassesForOwner = [archivedClass];
}

const prismaMock = {
  classSubject: {
    findFirst: async (args: { where?: { id?: string; schoolId?: string } }) => {
      const id = args.where?.id;
      if (id === archivedClass.id) return { ...archivedClass };
      return null;
    },
    findMany: async (args: {
      where?: {
        schoolId?: string;
        subjectCode?: string;
        enrollments?: { some?: { userId?: string } };
      };
    }) => {
      const userId = args.where?.enrollments?.some?.userId;
      if (
        args.where?.subjectCode === "MATH" &&
        userId === "teacher-owner" &&
        args.where?.schoolId === "school-1"
      ) {
        return state.subjectClassesForOwner.map((row) => ({ ...row }));
      }
      return [];
    },
    delete: async () => {
      track.classDeletes += 1;
      return { id: archivedClass.id };
    },
    count: async () => 0,
  },
  enrollment: {
    findFirst: async (args: {
      where?: { userId?: string; classSubjectId?: string; role?: string };
    }) => {
      const userId = args.where?.userId;
      if (
        args.where?.classSubjectId === archivedClass.id &&
        args.where?.role === "TEACHER" &&
        userId &&
        state.enrollments.has(userId)
      ) {
        return { id: `enr-${userId}`, userId, role: "TEACHER" };
      }
      return null;
    },
  },
  subjectArchive: {
    findUnique: async (args: {
      where?: {
        schoolId_teacherId_subjectCode?: {
          schoolId: string;
          teacherId: string;
          subjectCode: string;
        };
      };
    }) => {
      const key = args.where?.schoolId_teacherId_subjectCode;
      if (
        key &&
        key.schoolId === "school-1" &&
        key.subjectCode === "MATH" &&
        state.subjectArchiveOwnerId === key.teacherId
      ) {
        return {
          id: "arch-1",
          schoolId: key.schoolId,
          teacherId: key.teacherId,
          subjectCode: key.subjectCode,
        };
      }
      return null;
    },
    delete: async () => {
      track.subjectArchiveDeletes += 1;
      return { id: "arch-1" };
    },
  },
  exam: {
    findMany: async () => [],
    count: async () => 0,
  },
  submission: {
    count: async () => 2,
  },
  asset: {
    count: async () => 0,
  },
  subjectSyllabus: {
    findUnique: async () => null,
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

const { deleteArchivedClass, deleteArchivedSubject } = await import("./archive.ts");

beforeEach(() => {
  resetState();
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

test("deleteArchivedClass: owning teacher succeeds with matching confirm", async () => {
  await deleteArchivedClass(OWNER, "cs-1", { confirm: "3A" });
  assert.equal(track.classDeletes, 1);
});

test("deleteArchivedClass: owning teacher gets 400 when confirm missing", async () => {
  await expectAppError(deleteArchivedClass(OWNER, "cs-1", {}), 400, "delete_rejected");
  assert.equal(track.classDeletes, 0);
});

test("deleteArchivedClass: owning teacher gets 400 when confirm wrong", async () => {
  await expectAppError(
    deleteArchivedClass(OWNER, "cs-1", { confirm: "3B" }),
    400,
    "delete_rejected",
  );
  assert.equal(track.classDeletes, 0);
});

test("deleteArchivedClass: same-school teacher not enrolled gets 403", async () => {
  await expectAppError(
    deleteArchivedClass(OTHER_SAME_SCHOOL, "cs-1", { confirm: "3A" }),
    403,
    "forbidden",
  );
  assert.equal(track.classDeletes, 0);
});

test("deleteArchivedClass: other-school teacher gets 403", async () => {
  await expectAppError(
    deleteArchivedClass(OTHER_SCHOOL, "cs-1", { confirm: "3A" }),
    403,
    "forbidden",
  );
  assert.equal(track.classDeletes, 0);
});

test("deleteArchivedClass: student gets 403", async () => {
  await expectAppError(
    deleteArchivedClass(STUDENT, "cs-1", { confirm: "3A" }),
    403,
    "forbidden",
  );
});

test("deleteArchivedSubject: owning teacher succeeds with matching confirm", async () => {
  await deleteArchivedSubject(OWNER, "MATH", { confirm: "MATH" });
  assert.equal(track.classDeletes, 1);
  assert.equal(track.subjectArchiveDeletes, 1);
});

test("deleteArchivedSubject: owning teacher gets 400 when confirm wrong", async () => {
  await expectAppError(
    deleteArchivedSubject(OWNER, "MATH", { confirm: "ENG" }),
    400,
    "delete_rejected",
  );
  assert.equal(track.classDeletes, 0);
});

test("deleteArchivedSubject: same-school teacher not teaching subject gets 403", async () => {
  await expectAppError(
    deleteArchivedSubject(OTHER_SAME_SCHOOL, "MATH", { confirm: "MATH" }),
    403,
    "forbidden",
  );
});

test("deleteArchivedSubject: other-school teacher gets 403", async () => {
  await expectAppError(
    deleteArchivedSubject(OTHER_SCHOOL, "MATH", { confirm: "MATH" }),
    403,
    "forbidden",
  );
});

test("deleteArchivedSubject: student gets 403", async () => {
  await expectAppError(
    deleteArchivedSubject(STUDENT, "MATH", { confirm: "MATH" }),
    403,
    "forbidden",
  );
});
