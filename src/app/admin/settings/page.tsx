import { auth } from "@/auth";
import { logoutAction } from "@/app/login/actions";
import {
  getDictionary,
  parseLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { listAnalysisModelChoices } from "@/lib/school-settings";
import Link from "next/link";

/**
 * Admin school settings — minimal stub/TODO.
 * Full form + Prisma persistence are follow-ups.
 * Never surface API keys or vendor brand names in the UI.
 */
export default async function AdminSchoolSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const allowlist = listAnalysisModelChoices();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link
              href={`/?locale=${locale}`}
              className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--brand)]"
            >
              {t.brand}
            </Link>
            <span className="text-sm text-[var(--muted)]">{t.settingsTitle}</span>
          </div>
          <div className="flex items-center gap-4">
            <LocaleLinks locale={locale} />
            {session?.user ? (
              <form action={logoutAction}>
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="text-sm font-medium text-[var(--brand-deep)] hover:underline"
                >
                  {t.signOut}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <p className="text-sm text-[var(--muted)]">
          {session?.user?.email} · {session?.user?.role}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t.settingsTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          {t.settingsStub}
        </p>

        <section className="mt-10 max-w-xl space-y-3 text-sm text-[var(--muted)]">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.settingsFieldsHeading}
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t.settingsFieldDisplayName}</li>
            <li>{t.settingsFieldContact}</li>
            <li>{t.settingsFieldYear}</li>
            <li>{t.settingsFieldModel}</li>
            <li>{t.settingsFieldTeacherStudents}</li>
            <li>{t.settingsFieldTeacherUpload}</li>
          </ul>
        </section>

        <section className="mt-8 max-w-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.settingsAllowlistHeading}
          </h2>
          <ul className="mt-3 space-y-1 font-mono text-xs text-[var(--ink)]">
            {allowlist.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">{t.settingsAllowlistNote}</p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link
            href={`/admin?locale=${locale}`}
            className="font-medium text-[var(--brand)] hover:underline"
          >
            {t.backAdmin}
          </Link>
          <Link
            href={`/?locale=${locale}`}
            className="font-medium text-[var(--muted)] hover:underline"
          >
            {t.backHome}
          </Link>
        </div>
      </main>
    </div>
  );
}

function LocaleLinks({ locale }: { locale: Locale }) {
  return (
    <div className="flex gap-2 text-sm">
      <Link
        href="/admin/settings?locale=zh-HK"
        className={locale === "zh-HK" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}
      >
        繁
      </Link>
      <span className="text-[var(--border)]">|</span>
      <Link
        href="/admin/settings?locale=en"
        className={locale === "en" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}
      >
        EN
      </Link>
    </div>
  );
}
