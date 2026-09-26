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
    // Leave the loopback value in place. An empty string makes Auth.js call
    // `new URL("")` and every /api/auth request fails.
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

export type HeaderLookup = { get(name: string): string | null };

function hostnameFromHostHeader(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return (end === -1 ? trimmed : trimmed.slice(1, end)).toLowerCase();
  }
  return trimmed.replace(/:\d+$/, "").toLowerCase();
}

/**
 * Origin the browser used, such as http://203.0.113.10:3000.
 * Loopback hosts are ignored so a container health check cannot pin Auth.js
 * back to localhost. HTTP stays HTTP unless the proxy says https.
 */
export function publicOriginFromHeaders(headers: HeaderLookup): string | null {
  const forwardedHost = headers.get("x-forwarded-host");
  const host = (forwardedHost ?? headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
  if (!host) return null;
  if (LOOPBACK_HOSTS.has(hostnameFromHostHeader(host))) return null;
  const forwardedProto = (headers.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    ?.trim()
    .replace(/:$/, "")
    .toLowerCase();
  const proto = forwardedProto === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

/** Point Auth.js at the browser origin when the configured URL is missing or loopback. */
export function rememberPublicAuthOrigin(
  headers: HeaderLookup | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!headers) return;
  const origin = publicOriginFromHeaders(headers);
  if (!origin) return;
  const current = env.AUTH_URL || env.NEXTAUTH_URL;
  if (current && !isLoopbackAuthUrl(current)) return;
  try {
    env.AUTH_URL = origin;
    env.NEXTAUTH_URL = origin;
  } catch {
    // Edge process.env can be immutable. trustHost still uses the request host.
  }
}

/** Bracket access so Next.js does not inline an empty secret from the image build. */
export function readAuthSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const secret = (env["AUTH_SECRET"] || env["NEXTAUTH_SECRET"] || "").trim();
  if (!secret) return undefined;
  try {
    env["AUTH_SECRET"] = secret;
    env["NEXTAUTH_SECRET"] = secret;
  } catch {
    // The returned value is still passed into the Auth.js config.
  }
  return secret;
}

export function authCookiesAreSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.AUTH_URL || env.NEXTAUTH_URL || "";
  return raw.startsWith("https://");
}
