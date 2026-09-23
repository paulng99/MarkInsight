import { auth } from "@/auth";
import { logoutAction } from "@/app/login/actions";
import {
  getDictionary,
  parseLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";
import Link from "next/link";
import type { Role } from "@/lib/roles";

type ShellProps = {
  role: Role;
  titleKey: "adminShell" | "teacherShell" | "studentShell";
  emptyKey: "emptyAdmin" | "emptyTeacher" | "emptyStudent";
  searchParams: Promise<{ locale?: string }>;
};

export async function RoleShell({
  role,
  titleKey,
  emptyKey,
  searchParams,
}: ShellProps) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const user = session?.user;

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
            <span className="text-sm text-[var(--muted)]">{t[titleKey]}</span>
          </div>
          <div className="flex items-center gap-4">
            <LocaleLinks locale={locale} path={`/${role.toLowerCase()}`} />
            {user ? (
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
          {user?.email} · {user?.role}
          {user?.schoolId ? ` · school ${user.schoolId}` : ""}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t[titleKey]}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          {t[emptyKey]}
        </p>
        {role === "ADMIN" ? (
          <Link
            href={`/admin/settings?locale=${locale}`}
            className="mt-6 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            {t.settingsTitle}
          </Link>
        ) : null}
        <Link
          href={`/?locale=${locale}`}
          className="mt-8 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          {t.backHome}
        </Link>
      </main>
    </div>
  );
}

function LocaleLinks({ locale, path }: { locale: Locale; path: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <Link
        href={`${path}?locale=zh-HK`}
        className={locale === "zh-HK" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}
      >
        繁
      </Link>
      <span className="text-[var(--border)]">|</span>
      <Link
        href={`${path}?locale=en`}
        className={locale === "en" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}
      >
        EN
      </Link>
    </div>
  );
}
