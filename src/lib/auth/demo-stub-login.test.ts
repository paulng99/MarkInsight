import assert from "node:assert/strict";
import test from "node:test";
import {
  matchDemoStubCredentials,
  resolveDemoLoginPolicy,
  shouldShowLoginDemoBlock,
} from "./demo-login-policy.ts";

test("demo emails with password return null when policy disabled (no DB user path)", () => {
  const policy = resolveDemoLoginPolicy({ MARKINSIGHT_ANALYSIS_DEMO: "false" });
  assert.equal(policy.enabled, false);

  for (const email of [
    "admin@example.com",
    "teacher@example.com",
    "student@example.com",
  ]) {
    assert.equal(
      matchDemoStubCredentials(email, "password", policy),
      null,
      `expected null for ${email}`,
    );
  }
});

test("demo email accepts legacy password when ANALYSIS_DEMO enables policy", () => {
  const policy = resolveDemoLoginPolicy({ MARKINSIGHT_ANALYSIS_DEMO: "true" });
  const user = matchDemoStubCredentials("admin@example.com", "password", policy);
  assert.ok(user);
  assert.equal(user?.id, "demo_admin");
  assert.equal(user?.role, "ADMIN");
});

test("login demo block follows showHint (LoginForm not rendered — no .tsx loader)", () => {
  const hidden = resolveDemoLoginPolicy({});
  const shown = resolveDemoLoginPolicy({ MARKINSIGHT_ANALYSIS_DEMO: "true" });
  assert.equal(shouldShowLoginDemoBlock(hidden), false);
  assert.equal(shouldShowLoginDemoBlock(shown), true);
  assert.equal(shown.showHint, true);
});
