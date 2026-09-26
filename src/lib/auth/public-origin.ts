/**
 * Auth.js rewrites callbacks to AUTH_URL / NEXTAUTH_URL.
 * A copied .env uses http://localhost:3000, so opening the app by a
 * DigitalOcean public IP sends the browser back to the visitor's own machine.
 * Drop loopback values and let Auth.js use the request Host instead.
 */

const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
]);

export function authUrlHostname(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const hostname = new URL(trimmed).hostname;
    return hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isLoopbackAuthUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  const host = authUrlHostname(raw);
  return host !== null && LOOPBACK_HOSTS.has(host);
}

function clearEnv(env: NodeJS.ProcessEnv, key: "AUTH_URL" | "NEXTAUTH_URL"): void {
  try {
    delete env[key];
  } catch {
    // Edge middleware may expose a non-configurable process.env.
  }
  if (!env[key]) return;
  try {
    env[key] = "";
  } catch {
    // The container entrypoint also drops loopback URLs before Node starts.
  }
}

/** Mutates process.env. Call before NextAuth() reads the URL. */
export function preferRequestHostForLoopbackAuthUrl(
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    if (isLoopbackAuthUrl(env[key])) clearEnv(env, key);
  }
  if (!env.AUTH_TRUST_HOST) {
    try {
      env.AUTH_TRUST_HOST = "true";
    } catch {
      // NextAuth config already sets trustHost.
    }
  }
}
