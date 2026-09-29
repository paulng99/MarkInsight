import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_DEMO_PASSWORD,
  resolveDemoLoginPolicy,
  timingSafeStringEqual,
} from "./demo-login-policy.ts";

test("env password set and valid (>=12) enables demo without hint", () => {
  const policy = resolveDemoLoginPolicy({
    MARKINSIGHT_DEMO_PASSWORD: "strong-demo-1",
    MARKINSIGHT_ANALYSIS_DEMO: "false",
  });
  assert.equal(policy.enabled, true);
  assert.equal(policy.password, "strong-demo-1");
  assert.equal(policy.showHint, false);
  assert.equal(policy.invalidReason, undefined);
});

test("env password too short disables demo and marks invalid", () => {
  const policy = resolveDemoLoginPolicy({
    MARKINSIGHT_DEMO_PASSWORD: "short",
    MARKINSIGHT_ANALYSIS_DEMO: "true",
  });
  assert.equal(policy.enabled, false);
  assert.equal(policy.password, null);
  assert.equal(policy.showHint, false);
  assert.equal(policy.invalidReason, "too_short");
});

test("unset password + ANALYSIS_DEMO true uses legacy password and shows hint", () => {
  const policy = resolveDemoLoginPolicy({
    MARKINSIGHT_ANALYSIS_DEMO: "true",
  });
  assert.equal(policy.enabled, true);
  assert.equal(policy.password, LEGACY_DEMO_PASSWORD);
  assert.equal(policy.showHint, true);
  assert.equal(policy.invalidReason, undefined);
});

test("unset password + ANALYSIS_DEMO false disables demo", () => {
  const policy = resolveDemoLoginPolicy({
    MARKINSIGHT_ANALYSIS_DEMO: "false",
  });
  assert.equal(policy.enabled, false);
  assert.equal(policy.password, null);
  assert.equal(policy.showHint, false);
});

test("unset password + ANALYSIS_DEMO absent disables demo", () => {
  const policy = resolveDemoLoginPolicy({});
  assert.equal(policy.enabled, false);
  assert.equal(policy.password, null);
  assert.equal(policy.showHint, false);
});

test("empty string DEMO_PASSWORD disables demo", () => {
  const policy = resolveDemoLoginPolicy({
    MARKINSIGHT_DEMO_PASSWORD: "",
    MARKINSIGHT_ANALYSIS_DEMO: "true",
  });
  assert.equal(policy.enabled, false);
  assert.equal(policy.password, null);
  assert.equal(policy.showHint, false);
  assert.equal(policy.invalidReason, "empty");
});

test("timingSafeStringEqual matches equal strings", () => {
  assert.equal(timingSafeStringEqual("password", "password"), true);
  assert.equal(timingSafeStringEqual("password", "Password"), false);
});
