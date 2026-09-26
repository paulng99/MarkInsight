import assert from "node:assert/strict";
import test from "node:test";
import {
  isLoopbackAuthUrl,
  preferRequestHostForLoopbackAuthUrl,
} from "./public-origin.ts";

test("loopback auth URLs are ignored", () => {
  assert.equal(isLoopbackAuthUrl("http://localhost:3000"), true);
  assert.equal(isLoopbackAuthUrl("http://127.0.0.1:3000"), true);
  assert.equal(isLoopbackAuthUrl("http://[::1]:3000"), true);
  assert.equal(isLoopbackAuthUrl("http://0.0.0.0:3000"), true);
  assert.equal(isLoopbackAuthUrl("http://203.0.113.10:3000"), false);
  assert.equal(isLoopbackAuthUrl("https://markinsight.example.com"), false);
  assert.equal(isLoopbackAuthUrl(""), false);
});

test("preferRequestHost drops loopback and keeps a public origin", () => {
  const env: NodeJS.ProcessEnv = {
    NEXTAUTH_URL: "http://localhost:3000",
    AUTH_URL: "http://[::1]:3000",
  };
  preferRequestHostForLoopbackAuthUrl(env);
  assert.equal(env.NEXTAUTH_URL, undefined);
  assert.equal(env.AUTH_URL, undefined);
  assert.equal(env.AUTH_TRUST_HOST, "true");

  const pinned: NodeJS.ProcessEnv = {
    NEXTAUTH_URL: "http://203.0.113.10:3000",
    AUTH_TRUST_HOST: "true",
  };
  preferRequestHostForLoopbackAuthUrl(pinned);
  assert.equal(pinned.NEXTAUTH_URL, "http://203.0.113.10:3000");
});

test("immutable env falls back to an empty auth URL", () => {
  const env = Object.defineProperty({} as NodeJS.ProcessEnv, "NEXTAUTH_URL", {
    configurable: false,
    writable: true,
    value: "http://127.0.0.1:3000",
  });
  preferRequestHostForLoopbackAuthUrl(env);
  assert.equal(env.NEXTAUTH_URL, "");
  assert.equal(env.AUTH_TRUST_HOST, "true");
});
