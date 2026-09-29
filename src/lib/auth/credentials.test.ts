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

const { authorizeCredentials, isReservedDemoIdentity } = await import(
  "./credentials.ts"
);

const policyOff = () => ({
  enabled: false,
  password: null,
  showHint: false,
});

const policyDemoPassword = () => ({
  enabled: true,
  password: "strong-demo-pass12",
  showHint: false,
});

const policyLegacyDemo = () => ({
  enabled: true,
  password: "password",
  showHint: true,
});

test("authorizeCredentials returns null for demo email + password when policy off and no DB user", async () => {
  const result = await authorizeCredentials("admin@example.com", "password", {
    findUserByEmail: async () => null,
    getPolicy: policyOff,
  });
  assert.equal(result, null);
});

test("demo email with bcrypt hash of password is rejected when policy is off", async () => {
  const result = await authorizeCredentials("admin@example.com", "password", {
    findUserByEmail: async () => ({
      id: "demo_admin",
      email: "admin@example.com",
      name: "Demo Admin",
      role: "ADMIN",
      schoolId: null,
      passwordHash: "$2a$10$leftoverDemoHashFromLocalBootstrap",
    }),
    getPolicy: policyOff,
    // Even if the hash would match, demo identities must not authenticate.
    comparePassword: async () => true,
  });
  assert.equal(result, null);
});

test("demo id is rejected when policy is off even if email is not @example.com", async () => {
  const result = await authorizeCredentials("teacher@school.edu.hk", "password", {
    findUserByEmail: async () => ({
      id: "demo_teacher",
      email: "teacher@school.edu.hk",
      name: "Teacher",
      role: "TEACHER",
      schoolId: "demo_school",
      passwordHash: "$2a$10$leftover",
    }),
    getPolicy: policyOff,
    comparePassword: async () => true,
  });
  assert.equal(result, null);
});

test("normal email with a valid hash still succeeds when policy is off", async () => {
  const result = await authorizeCredentials(
    "you@school.edu.hk",
    "real-strong-password",
    {
      findUserByEmail: async () => ({
        id: "user_real_1",
        email: "you@school.edu.hk",
        name: "Real Admin",
        role: "ADMIN",
        schoolId: null,
        passwordHash: "$2a$10$realHash",
      }),
      getPolicy: policyOff,
      comparePassword: async (password, hash) =>
        password === "real-strong-password" && hash === "$2a$10$realHash",
    },
  );
  assert.equal(result?.id, "user_real_1");
  assert.equal(result?.email, "you@school.edu.hk");
});

test("MARKINSIGHT_DEMO_PASSWORD policy still allows stub demo when no DB hash", async () => {
  const result = await authorizeCredentials(
    "admin@example.com",
    "strong-demo-pass12",
    {
      findUserByEmail: async () => null,
      getPolicy: policyDemoPassword,
    },
  );
  assert.equal(result?.id, "demo_admin");
  assert.equal(result?.email, "admin@example.com");
});

test("legacy ANALYSIS_DEMO policy still accepts stub password when no DB hash", async () => {
  const result = await authorizeCredentials("teacher@example.com", "password", {
    findUserByEmail: async () => null,
    getPolicy: policyLegacyDemo,
  });
  assert.equal(result?.id, "demo_teacher");
});

test("isReservedDemoIdentity covers demo emails and ids", () => {
  assert.equal(
    isReservedDemoIdentity({ id: "x", email: "student@example.com" }),
    true,
  );
  assert.equal(
    isReservedDemoIdentity({ id: "demo_student", email: "other@school.edu.hk" }),
    true,
  );
  assert.equal(
    isReservedDemoIdentity({ id: "user_1", email: "you@school.edu.hk" }),
    false,
  );
});
