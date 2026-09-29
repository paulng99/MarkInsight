/**
 * Direct route-handler tests for POST /api/admin/class-subjects (delete_archived).
 * Mocks auth(); Prisma is not queried for these rejection paths.
 */

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

type AuthSession = {
  user?: { role?: string; schoolId?: string | null };
} | null;

const authState: { impl: () => Promise<AuthSession> } = {
  impl: async () => null,
};

(
  globalThis as unknown as {
    __MI_AUTH_MOCK__: typeof authState;
  }
).__MI_AUTH_MOCK__ = authState;

register(
  `data:text/javascript,${encodeURIComponent(`
    import { pathToFileURL } from "node:url";
    import { existsSync } from "node:fs";
    import path from "node:path";

    const root = "/workspace/src";

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
});
