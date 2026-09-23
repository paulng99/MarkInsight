import { auth } from "@/auth";
import { loginAction } from "./actions";
import {
  getDictionary,
  parseLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);

  if (session?.user) {
    redirect(
      session.user.role === "ADMIN"
        ? "/admin"
        : session.user.role === "TEACHER"
          ? "/teacher"
          : "/student",
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <Link href={`/?locale=${locale}`} className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--brand)]">
            {t.brand}
          </Link>
          <LocaleLinks locale={locale} path="/login" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          {t.signInTitle}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{t.demoHint}</p>
        {params.error ? (
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
            {params.error}
          </p>
        ) : null}
        <form action={loginAction} className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--ink)]">
            {t.email}
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-base outline-none ring-[var(--brand)] focus:ring-2"
              placeholder="teacher@example.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--ink)]">
            {t.password}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-base outline-none ring-[var(--brand)] focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)]"
          >
            {t.submit}
          </button>
        </form>
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
