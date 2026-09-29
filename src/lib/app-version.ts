/**
 * Build-time app version helpers for the global footer.
 * Version comes from package.json via next.config `env` → NEXT_PUBLIC_APP_VERSION.
 * Optional short SHA from GIT_COMMIT_SHA or NEXT_PUBLIC_APP_COMMIT (no git CLI).
 */

/** Return the first 7 characters of a commit SHA, or undefined when missing/blank. */
export function resolveCommitSha(commit?: string | null): string | undefined {
  if (commit == null) return undefined;
  const trimmed = commit.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 7);
}

/**
 * Format the footer version label in Hong Kong written Chinese.
 * Examples: 「版本 v0.1.0」 / 「版本 v0.1.0（a4ce9f5）」
 */
export function formatAppVersionLabel(
  version: string,
  commitSha?: string | null,
): string {
  const short = resolveCommitSha(commitSha);
  if (short) {
    return `版本 v${version}（${short}）`;
  }
  return `版本 v${version}`;
}

/** Read version / commit from env (build-injected or runtime). Missing SHA is fine. */
export function readAppVersionEnv(env: NodeJS.ProcessEnv = process.env): {
  version: string;
  commit?: string;
} {
  const version = env.NEXT_PUBLIC_APP_VERSION?.trim() ?? "";
  const commit =
    env.NEXT_PUBLIC_APP_COMMIT?.trim() ||
    env.GIT_COMMIT_SHA?.trim() ||
    undefined;
  return { version, commit };
}
