import { getDictionary, defaultLocale } from "@/lib/i18n/dictionaries";

/** Loading state for admin school settings (admin motion: low). */
export default function AdminSettingsLoading() {
  const t = getDictionary(defaultLocale);
  return (
    <div className="page-bg flex min-h-full flex-1">
      <div className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)]/80 lg:block" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10" role="status">
        <span className="sr-only">{t.settingsLoading}</span>
        <div className="skeleton h-8 w-64" />
        <div className="skeleton mt-3 h-4 w-96" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <div className="skeleton h-56" />
            <div className="skeleton h-40" />
            <div className="skeleton h-40" />
          </div>
          <div className="skeleton h-64" />
        </div>
      </main>
    </div>
  );
}
