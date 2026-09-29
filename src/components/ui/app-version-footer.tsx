import {
  formatAppVersionLabel,
  readAppVersionEnv,
} from "@/lib/app-version";

/**
 * Global, low-contrast version footer for every page (root layout).
 * Version is injected at build time — never reads package.json in the browser.
 */
export function AppVersionFooter() {
  const { version, commit } = readAppVersionEnv();
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
