import { auth } from "@/auth";
import { logoutAction } from "@/app/login/actions";
import { SchoolSettingsForm } from "@/components/admin/school-settings-form";
import {
  getDictionary,
  parseLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";
import {
  getSchoolSettingsPage,
  resolveAdminSchoolId,
} from "@/lib/school-settings";
import type { SchoolSettingsPageDto } from "@/lib/school-settings/types";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * Admin school settings — single page, one save.
 * Never surface API keys or vendor brand names in the UI.
 * Teachers/students are blocked by middleware (ADMIN only).
 */
export default async function AdminSchoolSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; schoolId?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);

  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/settings&locale=${locale}`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/?locale=${locale}`);
  }

  const schoolId = resolveAdminSchoolId(
    session.user.schoolId,
    params.schoolId,
  );

  let initialPage: SchoolSettingsPageDto | null = null;
  let initialError: string | null = null;
  try {
    initialPage = await getSchoolSettingsPage(schoolId);
  } catch (error) {
    initialError =
      error instanceof Error ? error.message : t.settingsErrorLoad;
  }

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
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="text-sm font-medium text-[var(--brand-deep)] hover:underline"
              >
                {t.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <p className="text-sm text-[var(--muted)]">
          {session.user.email} · {session.user.role}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t.settingsTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          {t.settingsIntro}
        </p>

        <SchoolSettingsForm
          locale={locale}
          t={t}
          initialPage={initialPage}
          initialError={initialError}
        />

        <div className="mt-12 flex flex-wrap gap-4 text-sm">
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
        className={
          locale === "zh-HK"
            ? "font-semibold text-[var(--brand)]"
            : "text-[var(--muted)]"
        }
      >
        繁
      </Link>
      <span className="text-[var(--border)]">|</span>
      <Link
        href="/admin/settings?locale=en"
        className={
          locale === "en"
            ? "font-semibold text-[var(--brand)]"
            : "text-[var(--muted)]"
        }
      >
        EN
      </Link>
    </div>
  );
}
