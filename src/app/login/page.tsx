import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginAction } from "./actions";
import { getDictionary, parseLocale } from "@/lib/i18n/dictionaries";
import { homePathForRole } from "@/lib/rbac";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icons";
import { LocaleSwitch } from "@/components/ui/locale-switch";

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
    redirect(`${homePathForRole(session.user.role)}?locale=${locale}`);
  }

  const highlights = [t.heroStat1, t.heroStat2, t.heroStat3];

  return (
    <div className="flex min-h-full flex-1 lg:grid lg:grid-cols-[1fr_1fr]">
      {/* Brand panel */}
      <aside className="hero-gradient relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl"
        />
        <div className="relative">
          <BrandLogo href={`/?locale=${locale}`} inverse />
        </div>
        <div className="relative max-w-md">
          <h2 className="display text-4xl leading-tight">{t.loginSidebarTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-blue-50/90">{t.loginSidebarDesc}</p>
          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                  <Icon.Check size={14} strokeWidth={3} />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-blue-100/70">{t.footerNote}</p>
      </aside>

      {/* Form panel */}
      <div className="page-bg flex flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <div className="lg:invisible">
            <BrandLogo href={`/?locale=${locale}`} />
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <LocaleSwitch locale={locale} />
            </Suspense>
            <Link href={`/?locale=${locale}`} className="btn btn-ghost btn-sm">
              <Icon.ArrowLeft size={16} />
              {t.backHome}
            </Link>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-16 pt-6 sm:px-8">
          <div className="card animate-fade-up w-full max-w-md p-6 sm:p-8">
            <p className="eyebrow">{t.brand}</p>
            <h1 className="display mt-2 text-3xl text-[var(--ink)]">{t.signInTitle}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{t.signInSubtitle}</p>
            <div className="mt-8">
              <LoginForm action={loginAction} locale={locale} t={t} error={params.error} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
