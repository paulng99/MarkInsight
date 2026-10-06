/**
 * Permission tests for GET /api/exams/[examId]/summary.
 * Teacher of class → 200; other teacher → 403; student → 403.
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

const authState: { impl: () => Promise<AuthSession> } = {
  impl: async () => null,
};

const summaryState: { teacherOwnsClass: boolean } = {
  teacherOwnsClass: true,
};

(
  globalThis as unknown as {
    __MI_AUTH_MOCK__: typeof authState;
    __MI_SUMMARY_STATE__: typeof summaryState;
  }
).__MI_AUTH_MOCK__ = authState;
(
  globalThis as unknown as { __MI_SUMMARY_STATE__: typeof summaryState }
).__MI_SUMMARY_STATE__ = summaryState;

const srcRoot = fileURLToPath(new URL("../../../", import.meta.url));
const mockSummaryUrl = pathToFileURL(
  fileURLToPath(new URL("./summary-route.exam-summary-mock.ts", import.meta.url)),
).href;

register(
  `data:text/javascript,${encodeURIComponent(`
    import { pathToFileURL } from "node:url";
    import { existsSync } from "node:fs";
    import path from "node:path";

    const root = ${JSON.stringify(srcRoot)};
    const mockSummary = ${JSON.stringify(mockSummaryUrl)};

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

const { GET } = await import("./[examId]/summary/route.ts");

function sessionFor(role: string, id: string) {
  return {
    user: {
      id,
      email: `${id}@example.com`,
      name: id,
      role,
      schoolId: "school-1",
    },
  };
}

async function getSummary() {
  return GET(new Request("http://localhost/api/exams/exam-1/summary"), {
    params: Promise.resolve({ examId: "exam-1" }),
  });
}

beforeEach(() => {
  summaryState.teacherOwnsClass = true;
});

test("teacher of class can load class exam summary", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-owner");
  summaryState.teacherOwnsClass = true;

  const res = await getSummary();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.uploadedCount, 1);
  assert.equal(body.summary.enrolledCount, 5);
  assert.equal(body.summary.weakestThree[0].questionKey, "Q1");
  assert.equal(body.summary.student, undefined);
  assert.ok(!JSON.stringify(body).includes("studentId"));
});

test("other teacher without class enrollment gets 403", async () => {
  authState.impl = async () => sessionFor("TEACHER", "teacher-other");
  summaryState.teacherOwnsClass = false;

  const res = await getSummary();
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, "forbidden");
});

test("student gets 403", async () => {
  authState.impl = async () => sessionFor("STUDENT", "student-1");

  const res = await getSummary();
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, "forbidden");
});
