import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAppVersionLabel,
  readAppVersionEnv,
  resolveCommitSha,
} from "./app-version.ts";

test("formatAppVersionLabel shows version only when SHA is missing", () => {
  assert.equal(formatAppVersionLabel("0.1.0"), "版本 v0.1.0");
  assert.equal(formatAppVersionLabel("0.1.0", null), "版本 v0.1.0");
  assert.equal(formatAppVersionLabel("0.1.0", undefined), "版本 v0.1.0");
  assert.equal(formatAppVersionLabel("0.1.0", ""), "版本 v0.1.0");
  assert.equal(formatAppVersionLabel("0.1.0", "   "), "版本 v0.1.0");
});

test("formatAppVersionLabel appends short SHA when provided", () => {
  assert.equal(
    formatAppVersionLabel("0.1.0", "a4ce9f5"),
    "版本 v0.1.0（a4ce9f5）",
  );
  assert.equal(
    formatAppVersionLabel("0.1.0", "a4ce9f5deadbeef"),
    "版本 v0.1.0（a4ce9f5）",
  );
});

test("resolveCommitSha never throws on missing values", () => {
  assert.equal(resolveCommitSha(undefined), undefined);
  assert.equal(resolveCommitSha(null), undefined);
  assert.equal(resolveCommitSha(""), undefined);
  assert.equal(resolveCommitSha("abc1234"), "abc1234");
});

test("readAppVersionEnv prefers NEXT_PUBLIC_APP_COMMIT over GIT_COMMIT_SHA", () => {
  const env = {
    NEXT_PUBLIC_APP_VERSION: "0.1.0",
    NEXT_PUBLIC_APP_COMMIT: "bbbbbbb",
    GIT_COMMIT_SHA: "aaaaaaa1111111",
  } as NodeJS.ProcessEnv;
  assert.deepEqual(readAppVersionEnv(env), {
    version: "0.1.0",
    commit: "bbbbbbb",
  });
});

test("readAppVersionEnv falls back to GIT_COMMIT_SHA and tolerates missing SHA", () => {
  assert.deepEqual(
    readAppVersionEnv({
      NEXT_PUBLIC_APP_VERSION: "0.1.0",
      GIT_COMMIT_SHA: "a4ce9f5deadbeef",
    } as NodeJS.ProcessEnv),
    { version: "0.1.0", commit: "a4ce9f5deadbeef" },
  );
  assert.deepEqual(
    readAppVersionEnv({
      NEXT_PUBLIC_APP_VERSION: "0.1.0",
    } as NodeJS.ProcessEnv),
    { version: "0.1.0", commit: undefined },
  );
});
