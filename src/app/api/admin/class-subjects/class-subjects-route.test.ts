/**
 * Direct route-handler tests for POST /api/admin/class-subjects (delete_archived).
 * Mocks auth() and `@/lib/prisma` so wrong-confirm paths cannot pass via DB errors.
 */

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

type AuthSession = {
  user?: { role?: string; schoolId?: string | null };
} | null;

const authState: { impl: () => Promise<AuthSession> } = {
  impl: async () => null,
};

const prismaTrack = {
  transactionCalls: 0,
  classDeleteManyCalls: 0,
};

function resetPrismaTrack() {
  prismaTrack.transactionCalls = 0;
  prismaTrack.classDeleteManyCalls = 0;
}

function createTx() {
  return {
    classSubject: {
      findMany: async () => [{ subjectCode: "MATH" }],
      deleteMany: async () => {
        prismaTrack.classDeleteManyCalls += 1;
        return { count: 1 };
      },
      count: async () => 1,
    },
    exam: { count: async () => 0 },
    submission: { count: async () => 0 },
    analysisJob: { count: async () => 0 },
    subjectSyllabus: {
      deleteMany: async () => ({ count: 0 }),
    },
  };
}

const prismaMock = {
  $transaction: async <T>(
    fn: (tx: ReturnType<typeof createTx>) => Promise<T>,
  ) => {
    prismaTrack.transactionCalls += 1;
    return fn(createTx());
  },
};

(
  globalThis as unknown as {
    __MI_AUTH_MOCK__: typeof authState;
    __MI_PRISMA_MOCK__: typeof prismaMock;
  }
).__MI_AUTH_MOCK__ = authState;
(
  globalThis as unknown as {
    __MI_PRISMA_MOCK__: typeof prismaMock;
  }
).__MI_PRISMA_MOCK__ = prismaMock;

// Derive src root from this test file so npm test works outside /workspace.
const srcRoot = fileURLToPath(new URL("../../../../", import.meta.url));

register(
  `data:text/javascript,${encodeURIComponent(`
    import { pathToFileURL } from "node:url";
    import { existsSync } from "node:fs";
    import path from "node:path";

    const root = ${JSON.stringify(srcRoot)};

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

      // next/package exports need the .js extension under node:test ESM.
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

const { POST } = await import("./route.ts");
const {
  ADMIN_DELETE_REJECTED_CODE,
  ADMIN_DELETE_REJECTED_MESSAGE_EN,
} = await import("../../../../lib/admin/delete-confirm.ts");

async function postDeleteArchived(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/admin/class-subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete_archived", ...body }),
  });
  return POST(request);
}

beforeEach(() => {
  resetPrismaTrack();
});

after(() => {
  authState.impl = async () => null;
});

test("route delete_archived: non-admin receives opaque 403", async () => {
  authState.impl = async () => ({
    user: { role: "TEACHER", schoolId: "school_a" },
  });
  const res = await postDeleteArchived({
    schoolId: "school_a",
    confirm: "刪除",
    expectedClasses: 1,
    expectedExams: 0,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
  });
  assert.equal(res.status, 403);
  const json = (await res.json()) as { error: string; code: string };
  assert.equal(json.code, ADMIN_DELETE_REJECTED_CODE);
  assert.equal(json.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  assert.equal(prismaTrack.transactionCalls, 0);
});

test("route delete_archived: cross-school receives opaque 403", async () => {
  authState.impl = async () => ({
    user: { role: "ADMIN", schoolId: "school_a" },
  });
  const res = await postDeleteArchived({
    schoolId: "school_b",
    confirm: "刪除",
    expectedClasses: 1,
    expectedExams: 0,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
  });
  assert.equal(res.status, 403);
  const json = (await res.json()) as { error: string; code: string };
  assert.equal(json.code, ADMIN_DELETE_REJECTED_CODE);
  assert.equal(json.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  assert.doesNotMatch(json.error, /school/i);
  assert.equal(prismaTrack.transactionCalls, 0);
});

test("route delete_archived: omitting expected* receives opaque 400", async () => {
  authState.impl = async () => ({
    user: { role: "ADMIN", schoolId: "school_a" },
  });
  const res = await postDeleteArchived({
    schoolId: "school_a",
    confirm: "刪除",
    expectedClasses: 1,
    expectedExams: 0,
    expectedSubmissions: 0,
    // expectedAnalysisJobs omitted
  });
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error: string; code: string };
  assert.equal(json.code, ADMIN_DELETE_REJECTED_CODE);
  assert.equal(json.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  assert.equal(prismaTrack.transactionCalls, 0);
});

test("route delete_archived: non-string schoolId receives opaque 403", async () => {
  authState.impl = async () => ({
    user: { role: "ADMIN", schoolId: "school_a" },
  });
  const res = await postDeleteArchived({
    schoolId: 123,
    confirm: "刪除",
    expectedClasses: 1,
    expectedExams: 0,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
  });
  assert.equal(res.status, 403);
  const json = (await res.json()) as { error: string; code: string };
  assert.equal(json.code, ADMIN_DELETE_REJECTED_CODE);
  assert.equal(json.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  assert.equal(prismaTrack.transactionCalls, 0);
});

test("route delete_archived: wrong confirm receives opaque 400 and never deletes", async () => {
  authState.impl = async () => ({
    user: { role: "ADMIN", schoolId: "school_a" },
  });
  const res = await postDeleteArchived({
    schoolId: "school_a",
    confirm: "DELETE",
    expectedClasses: 1,
    expectedExams: 0,
    expectedSubmissions: 0,
    expectedAnalysisJobs: 0,
  });
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error: string; code: string };
  assert.equal(json.code, ADMIN_DELETE_REJECTED_CODE);
  assert.equal(json.error, ADMIN_DELETE_REJECTED_MESSAGE_EN);
  // Must fail on confirm — not because Prisma is missing.
  assert.equal(prismaTrack.transactionCalls, 0);
  assert.equal(prismaTrack.classDeleteManyCalls, 0);
});
