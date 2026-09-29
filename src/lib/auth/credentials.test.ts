import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

// Resolve extensionless relative imports used by credentials.ts under node:test.
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.startsWith(".") && !specifier.match(/\\.[a-zA-Z0-9]+$/)) {
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

const { authorizeCredentials } = await import("./credentials.ts");

test("authorizeCredentials returns null for demo email + password when policy off and no DB user", async () => {
  const result = await authorizeCredentials("admin@example.com", "password", {
    findUserByEmail: async () => null,
    getPolicy: () => ({
      enabled: false,
      password: null,
      showHint: false,
    }),
  });
  assert.equal(result, null);
});
