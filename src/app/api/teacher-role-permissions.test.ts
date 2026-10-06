/**
 * Teacher-facing role permission matrix.
 *
 * Nine required cases (owner / other teacher / student × summary / delete / re-analyse)
 * plus unauthenticated 401 and archived-class 409 where assertClassIsActive applies.
 */

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

type AuthSession = {
  user?: {
    id?: string;
    email?: string;
    name?: string | null;
    role?: string;
    schoolId?: string | null;
  };
} | null;

type ServiceState = {
  ownerId: string;
  classArchived: boolean;
  deleteConfirmOk: boolean;
  deleted: boolean;
  analysisStarted: boolean;
};

const authState: { impl: () => Promise<AuthSession> } = {
  impl: async () => null,
};

const serviceState: ServiceState = {
  ownerId: "teacher-owner",
  classArchived: false,
  deleteConfirmOk: true,
  deleted: false,
  analysisStarted: false,
};

(
  globalThis as unknown as {
    __MI_AUTH_MOCK__: typeof authState;
    __MI_PERM_STATE__: typeof serviceState;
  }
).__MI_AUTH_MOCK__ = authState;
(
  globalThis as unknown as { __MI_PERM_STATE__: typeof serviceState }
).__MI_PERM_STATE__ = serviceState;

const srcRoot = fileURLToPath(new URL("../../", import.meta.url));
const mockSummaryUrl = pathToFileURL(
  fileURLToPath(new URL("./exams/summary-route.exam-summary-mock.ts", import.meta.url)),
).href;
const mockPermUrl = pathToFileURL(
  fileURLToPath(new URL("./teacher-role-permissions.mock.ts", import.meta.url)),
).href;

register(
  `data:text/javascript,${encodeURIComponent(`
    import { pathToFileURL } from "node:url";
    import { existsSync } from "node:fs";
    import path from "node:path";

    const root = ${JSON.stringify(srcRoot)};
    const mockSummary = ${JSON.stringify(mockSummaryUrl)};
    const mockPerm = ${JSON.stringify(mockPermUrl)};

    export async function resolve(specifier, context, nextResolve) {
      if (specifier === "@/auth") {
        return {
          shortCircuit: true,
          url:
            "data:text/javascript," +
            encodeURIComponent(\`
              export async function auth() {
                return globalThis.__MI_AUTH_MOCK__.impl();
              }
            \`),
        };
      }

      if (specifier === "@/lib/aggregates/exam-summary") {
        return { shortCircuit: true, url: mockSummary };
      }

      if (
        specifier === "@/lib/subjects/archive" ||
        specifier === "@/lib/exams/service"
      ) {
        return { shortCircuit: true, url: mockPerm };
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

      if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
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

const { GET: getSummary } = await import("./exams/[examId]/summary/route.ts");
const { DELETE: deleteClass } = await import(
  "./class-subjects/[classSubjectId]/route.ts"
);
const { POST: postAnalyze } = await import("./exams/[examId]/analyze/route.ts");

function sessionFor(role: string, id: string, schoolId = "school-1") {
  return {
    user: {
      id,
      email: `${id}@example.com`,
      name: id,
      role,
      schoolId,
    },
  };
}

function resetState() {
  serviceState.ownerId = "teacher-owner";
  serviceState.classArchived = false;
  serviceState.deleteConfirmOk = true;
  serviceState.deleted = false;
  serviceState.analysisStarted = false;
  (
    globalThis as unknown as { __MI_SUMMARY_STATE__: { teacherOwnsClass: boolean } }
  ).__MI_SUMMARY_STATE__ = { teacherOwnsClass: true };
}

beforeEach(() => {
  resetState();
});

async function callSummary() {
  return getSummary(new Request("http://localhost/api/exams/exam-1/summary"), {
    params: Promise.resolve({ examId: "exam-1" }),
  });
}

async function callDelete(confirm?: string) {
  return deleteClass(
    new Request("http://localhost/api/class-subjects/cs-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirm === undefined ? {} : { confirm }),
    }),
    { params: Promise.resolve({ classSubjectId: "cs-1" }) },
  );
}

async function callAnalyze() {
  return postAnalyze(new Request("http://localhost/api/exams/exam-1/analyze", {
    method: "POST",
  }), {
    params: Promise.resolve({ examId: "exam-1" }),
  });
}

// --- Nine required cases ---

test("1 owning teacher + class summary → 200", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-owner");
  (
    globalThis as unknown as { __MI_SUMMARY_STATE__: { teacherOwnsClass: boolean } }
  ).__MI_SUMMARY_STATE__.teacherOwnsClass = true;
  const res = await callSummary();
  assert.equal(res.status, 200);
});

test("2 other teacher + class summary → 403", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-other");
  (
    globalThis as unknown as { __MI_SUMMARY_STATE__: { teacherOwnsClass: boolean } }
  ).__MI_SUMMARY_STATE__.teacherOwnsClass = false;
  const res = await callSummary();
  assert.equal(res.status, 403);
});

test("3 student + class summary → 403", async () => {
  authState.impl = async () => sessionFor("STUDENT", "student-1");
  const res = await callSummary();
  assert.equal(res.status, 403);
});

test("4 owning teacher + permanent delete → 200", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-owner");
  const res = await callDelete("3A");
  assert.equal(res.status, 200);
  assert.equal(serviceState.deleted, true);
});

test("5 other teacher + permanent delete → 403", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-other");
  const res = await callDelete("3A");
  assert.equal(res.status, 403);
  assert.equal(serviceState.deleted, false);
});

test("6 student + permanent delete → 403", async () => {
  authState.impl = async () => sessionFor("STUDENT", "student-1");
  const res = await callDelete("3A");
  assert.equal(res.status, 403);
});

test("7 owning teacher + re-analyse → 200", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-owner");
  const res = await callAnalyze();
  assert.equal(res.status, 200);
  assert.equal(serviceState.analysisStarted, true);
});

test("8 other teacher + re-analyse → 403", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-other");
  const res = await callAnalyze();
  assert.equal(res.status, 403);
  assert.equal(serviceState.analysisStarted, false);
});

test("9 student + re-analyse → 403", async () => {
  authState.impl = async () => sessionFor("STUDENT", "student-1");
  const res = await callAnalyze();
  assert.equal(res.status, 403);
});

// --- Extra product cases ---

test("unauthenticated summary → 401", async () => {
  authState.impl = async () => null;
  const res = await callSummary();
  assert.equal(res.status, 401);
});

test("unauthenticated delete → 401", async () => {
  authState.impl = async () => null;
  const res = await callDelete("3A");
  assert.equal(res.status, 401);
});

test("unauthenticated re-analyse → 401", async () => {
  authState.impl = async () => null;
  const res = await callAnalyze();
  assert.equal(res.status, 401);
});

test("owning teacher + re-analyse on archived class → 409", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-owner");
  serviceState.classArchived = true;
  const res = await callAnalyze();
  assert.equal(res.status, 409);
});

test("owning teacher + delete missing confirm → 400", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-owner");
  serviceState.deleteConfirmOk = false;
  const res = await callDelete();
  assert.equal(res.status, 400);
  assert.equal(serviceState.deleted, false);
});
