import assert from "node:assert/strict";
import test from "node:test";
import {
  authCookiesAreSecure,
  isLoopbackAuthUrl,
  preferRequestHostForLoopbackAuthUrl,
  publicOriginFromHeaders,
  readAuthSecret,
  rememberPublicAuthOrigin,
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

test("immutable env keeps a loopback auth URL", () => {
  const env = Object.defineProperty({} as NodeJS.ProcessEnv, "NEXTAUTH_URL", {
    configurable: false,
    writable: true,
    value: "http://127.0.0.1:3000",
  });
  preferRequestHostForLoopbackAuthUrl(env);
  assert.equal(env.NEXTAUTH_URL, "http://127.0.0.1:3000");
  assert.equal(env.AUTH_TRUST_HOST, "true");
});

test("public origin follows the browser host and stays on http", () => {
  const headers = new Headers({ host: "203.0.113.10:3000" });
  assert.equal(publicOriginFromHeaders(headers), "http://203.0.113.10:3000");
  assert.equal(
    publicOriginFromHeaders(
      new Headers({
        host: "localhost:3000",
        "x-forwarded-host": "203.0.113.10:3000",
        "x-forwarded-proto": "https,http",
      }),
    ),
    "https://203.0.113.10:3000",
  );
  assert.equal(publicOriginFromHeaders(new Headers({ host: "localhost:3000" })), null);
});

test("rememberPublicAuthOrigin replaces loopback and keeps a pinned https origin", () => {
  const env: NodeJS.ProcessEnv = { NEXTAUTH_URL: "http://localhost:3000" };
  rememberPublicAuthOrigin(new Headers({ host: "203.0.113.10:3000" }), env);
  assert.equal(env.AUTH_URL, "http://203.0.113.10:3000");
  assert.equal(authCookiesAreSecure(env), false);

  const pinned: NodeJS.ProcessEnv = { AUTH_URL: "https://markinsight.example.com" };
  rememberPublicAuthOrigin(new Headers({ host: "203.0.113.10:3000" }), pinned);
  assert.equal(pinned.AUTH_URL, "https://markinsight.example.com");
  assert.equal(authCookiesAreSecure(pinned), true);
});

test("readAuthSecret accepts either env name", () => {
  const env: NodeJS.ProcessEnv = { NEXTAUTH_SECRET: "  school-secret  " };
  assert.equal(readAuthSecret(env), "school-secret");
  assert.equal(env.AUTH_SECRET, "school-secret");
});
