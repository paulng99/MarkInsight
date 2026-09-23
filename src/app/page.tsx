import { auth } from "@/auth";
import { logoutAction } from "@/app/login/actions";
import {
  getDictionary,
  parseLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";
import Link from "next/link";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--brand-soft)_0%,_transparent_55%),linear-gradient(165deg,_#e8f1fb_0%,_#f7fafc_42%,_#eef6ff_100%)]"
      />
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-40"
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--brand)] animate-fade-up">
          {t.brand}
        </p>
        <div className="flex items-center gap-4 animate-fade-up-delay">
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
          ) : (
            <Link
              href={`/login?locale=${locale}`}
              className="rounded-md bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)]"
            >
              {t.ctaSignIn}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-20 pt-8">
        <p className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.1] tracking-tight text-[var(--brand)] sm:text-6xl animate-fade-up">
          {t.brand}
        </p>
        <h1 className="mt-5 max-w-2xl text-2xl font-medium leading-snug text-[var(--ink)] sm:text-3xl animate-fade-up-delay">
          {t.tagline}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)] animate-fade-up-delay-2">
          {t.supporting}
        </p>

        <div className="mt-8 flex flex-wrap gap-3 animate-fade-up-delay-2">
          <Link
            href={`/login?locale=${locale}`}
            className="rounded-md bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-deep)]"
          >
            {t.ctaSignIn}
          </Link>
          <a
            href="https://github.com/paulng99/MarkInsight/blob/main/docs/architecture.md"
            className="rounded-md border border-[var(--border)] bg-white/70 px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            target="_blank"
            rel="noreferrer"
          >
            {t.ctaDocs}
          </a>
        </div>

        <section className="mt-16 max-w-xl animate-fade-up-delay-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.rolesTitle}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
            <li>{t.roleAdmin}</li>
            <li>{t.roleTeacher}</li>
            <li>{t.roleStudent}</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function LocaleLinks({ locale }: { locale: Locale }) {
  return (
    <div className="flex gap-2 text-sm">
      <Link
        href="/?locale=zh-HK"
        className={locale === "zh-HK" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}
      >
        繁
      </Link>
      <span className="text-[var(--border)]">|</span>
      <Link
        href="/?locale=en"
        className={locale === "en" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}
      >
        EN
      </Link>
    </div>
  );
}
