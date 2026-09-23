import { getDictionary, defaultLocale } from "@/lib/i18n/dictionaries";

/** Loading state for admin school settings (admin motion: low). */
export default function AdminSettingsLoading() {
  const t = getDictionary(defaultLocale);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <p
          className="mt-8 text-sm text-[var(--muted)] transition-opacity duration-[var(--motion-base)]"
          role="status"
        >
          {t.settingsLoading}
        </p>
      </main>
    </div>
  );
}
