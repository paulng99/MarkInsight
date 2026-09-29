import { formatAppVersionLabel } from "@/lib/app-version";

/**
 * Global, low-contrast version footer for every page (root layout).
 * Version is injected at build time via next.config `env` — never reads
 * package.json in the browser. Access NEXT_PUBLIC_* via direct process.env
 * property reads so Next.js can inline them at build time.
 */
export function AppVersionFooter() {
  // Direct property access required for Next.js build-time inlining.
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() ?? "";
  const commit =
    process.env.NEXT_PUBLIC_APP_COMMIT?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    undefined;

  if (!version) return null;

  const label = formatAppVersionLabel(version, commit);

  return (
    <footer
      className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]/60"
      aria-label={label}
    >
      <div className="mx-auto flex w-full max-w-6xl justify-end px-4 py-2.5 sm:px-6 lg:px-10">
        <p className="text-xs leading-none text-[var(--muted)]">{label}</p>
      </div>
    </footer>
  );
}
