/**
 * Demo-account login policy for public vs local/offline deployments.
 *
 * Production must never accept the legacy default password "password".
 * Local docker-compose / laptop verify may keep that default when
 * MARKINSIGHT_ANALYSIS_DEMO=true and MARKINSIGHT_DEMO_PASSWORD is unset.
 */

export const LEGACY_DEMO_PASSWORD = "password";
export const MIN_DEMO_PASSWORD_LENGTH = 12;

export type DemoLoginEnv = {
  MARKINSIGHT_DEMO_PASSWORD?: string;
  MARKINSIGHT_ANALYSIS_DEMO?: string;
  [key: string]: string | undefined;
};

export type DemoLoginPolicy = {
  /** Whether stub demo emails may authenticate without a DB passwordHash. */
  enabled: boolean;
  /** Password to accept when enabled; null when disabled. */
  password: string | null;
  /**
   * Show the login-page demo account list and the literal "password" hint.
   * Only true for the legacy offline path (ANALYSIS_DEMO + no env password).
   */
  showHint: boolean;
  /** Present when MARKINSIGHT_DEMO_PASSWORD was provided but rejected. */
  invalidReason?: "empty" | "too_short";
};

/**
 * Pure decision function — safe for unit tests. Does not log or read process.env
 * unless the caller passes process.env.
 */
export function resolveDemoLoginPolicy(env: DemoLoginEnv): DemoLoginPolicy {
  if (Object.prototype.hasOwnProperty.call(env, "MARKINSIGHT_DEMO_PASSWORD")) {
    const raw = env.MARKINSIGHT_DEMO_PASSWORD ?? "";
    if (raw.length === 0) {
      return {
        enabled: false,
        password: null,
        showHint: false,
        invalidReason: "empty",
      };
    }
    if (raw.length < MIN_DEMO_PASSWORD_LENGTH) {
      return {
        enabled: false,
        password: null,
        showHint: false,
        invalidReason: "too_short",
      };
    }
    return { enabled: true, password: raw, showHint: false };
  }

  if (env.MARKINSIGHT_ANALYSIS_DEMO === "true") {
    return {
      enabled: true,
      password: LEGACY_DEMO_PASSWORD,
      showHint: true,
    };
  }

  return { enabled: false, password: null, showHint: false };
}

let warnedInvalidDemoPassword = false;

/** Resolve policy from process.env and warn once when the env password is invalid. */
export function getDemoLoginPolicy(
  env: NodeJS.ProcessEnv = process.env,
): DemoLoginPolicy {
  const policy = resolveDemoLoginPolicy(env);
  if (policy.invalidReason && !warnedInvalidDemoPassword) {
    warnedInvalidDemoPassword = true;
    if (policy.invalidReason === "empty") {
      console.warn(
        "[auth] MARKINSIGHT_DEMO_PASSWORD is empty; demo login is disabled.",
      );
    } else {
      console.warn(
        `[auth] MARKINSIGHT_DEMO_PASSWORD must be at least ${MIN_DEMO_PASSWORD_LENGTH} characters; demo login is disabled.`,
      );
    }
  }
  return policy;
}

/**
 * Constant-time string compare (no node:crypto — safe for Edge import graphs).
 * Length mismatch still returns false; byte loop does not short-circuit on mismatch.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  const len = Math.max(aBuf.length, bBuf.length);
  let diff = aBuf.length === bBuf.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0);
  }
  return diff === 0;
}
