import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/login/actions";
import { getDictionary, parseLocale, type Dictionary } from "@/lib/i18n/dictionaries";
import { homePathForRole } from "@/lib/rbac";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icons";
import { LocaleSwitch } from "@/components/ui/locale-switch";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const user = session?.user;
  const workspaceHref = user ? `${homePathForRole(user.role)}?locale=${locale}` : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--background)]">
      {/* ---------------------------------------------------------------- nav */}
      <header className="glass sticky top-0 z-30 border-b border-white/40">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <BrandLogo href={`/?locale=${locale}`} />
          <div className="flex items-center gap-2 sm:gap-3">
            <Suspense fallback={null}>
              <LocaleSwitch locale={locale} />
            </Suspense>
            {workspaceHref ? (
              <>
                <Link href={workspaceHref} className="btn btn-primary btn-sm">
                  {t.ctaWorkspace}
                  <Icon.ArrowRight size={16} />
                </Link>
                <form action={logoutAction} className="hidden sm:block">
                  <input type="hidden" name="locale" value={locale} />
                  <button type="submit" className="btn btn-ghost btn-sm">
                    {t.signOut}
                  </button>
                </form>
              </>
            ) : (
              <Link href={`/login?locale=${locale}`} className="btn btn-primary btn-sm">
                {t.ctaSignIn}
                <Icon.ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* -------------------------------------------------------------- hero */}
        <section className="hero-gradient relative overflow-hidden text-white">
          <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-70" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-24">
            <div>
              <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
                <Icon.Sparkles size={14} />
                {t.heroEyebrow}
              </p>
              <h1 className="display animate-fade-up-delay mt-6 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
                {t.heroTitleA}
                <br />
                <span className="bg-[linear-gradient(90deg,#c8f5ee,#bfe0ff)] bg-clip-text text-transparent">
                  {t.heroTitleB}
                </span>
              </h1>
              <p className="animate-fade-up-delay-2 mt-6 max-w-xl text-base leading-relaxed text-blue-50/90 sm:text-lg">
                {t.supporting}
              </p>
              <div className="animate-fade-up-delay-3 mt-9 flex flex-wrap gap-3">
                <Link
                  href={workspaceHref ?? `/login?locale=${locale}`}
                  className="btn btn-inverse btn-lg"
                >
                  {workspaceHref ? t.ctaWorkspace : t.ctaSignIn}
                  <Icon.ArrowRight size={18} />
                </Link>
                <a
                  href="#how-it-works"
                  className="btn btn-lg border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  {t.ctaDocs}
                </a>
              </div>
              <ul className="animate-fade-up-delay-3 mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-blue-50/90">
                {[t.heroStat1, t.heroStat2, t.heroStat3].map((s) => (
                  <li key={s} className="inline-flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/90 text-blue-950">
                      <Icon.Check size={12} strokeWidth={3} />
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <ProductPreview t={t} />
          </div>
        </section>

        {/* ------------------------------------------------------- how it works */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="eyebrow">{t.ctaDocs}</p>
            <h2 className="display mt-3 text-3xl text-[var(--ink)] sm:text-4xl">
              {t.featuresTitle}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t.featuresIntro}</p>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                n: "01",
                title: t.step1Title,
                desc: t.step1Desc,
                icon: <Icon.FileText size={22} />,
                tile: { bg: "var(--blue-100)", fg: "var(--blue-700)" },
              },
              {
                n: "02",
                title: t.step2Title,
                desc: t.step2Desc,
                icon: <Icon.Upload size={22} />,
                tile: { bg: "#e3f6f3", fg: "var(--teal-600)" },
              },
              {
                n: "03",
                title: t.step3Title,
                desc: t.step3Desc,
                icon: <Icon.Target size={22} />,
                tile: { bg: "#efeafd", fg: "var(--violet-600)" },
              },
            ].map((s) => (
              <li key={s.n} className="card card-hover card-pad relative">
                <span className="display absolute right-5 top-4 text-4xl text-[var(--slate-100)]">
                  {s.n}
                </span>
                <span
                  className="icon-tile !h-12 !w-12 !rounded-2xl"
                  style={{ ["--tile-bg" as string]: s.tile.bg, ["--tile-fg" as string]: s.tile.fg }}
                >
                  {s.icon}
                </span>
                <h3 className="mt-5 text-lg font-bold text-[var(--ink)]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* -------------------------------------------------------------- roles */}
        <section className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
            <div className="max-w-2xl">
              <p className="eyebrow">{t.rolesTitle}</p>
              <h2 className="display mt-3 text-3xl text-[var(--ink)] sm:text-4xl">{t.rolesTitle}</h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <RoleCard
                tone="admin"
                icon={<Icon.Shield size={22} />}
                title={t.roleAdminLabel}
                desc={t.roleAdminDesc}
              />
              <RoleCard
                tone="teacher"
                icon={<Icon.BookOpen size={22} />}
                title={t.roleTeacherLabel}
                desc={t.roleTeacherDesc}
              />
              <RoleCard
                tone="student"
                icon={<Icon.GraduationCap size={22} />}
                title={t.roleStudentLabel}
                desc={t.roleStudentDesc}
              />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- cta */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="role-hero role-hero--teacher px-8 py-12 sm:px-12 sm:py-14">
            <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="display text-2xl sm:text-3xl">{t.landingCtaTitle}</h2>
                <p className="mt-3 text-blue-50/90">{t.landingCtaDesc}</p>
              </div>
              <Link
                href={workspaceHref ?? `/login?locale=${locale}`}
                className="btn btn-inverse btn-lg"
              >
                {workspaceHref ? t.ctaWorkspace : t.ctaSignIn}
                <Icon.ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-[var(--muted)] sm:px-8">
          <span className="inline-flex items-center gap-2">
            <BrandLogo href={`/?locale=${locale}`} compact />
            <span>© {new Date().getFullYear()} MarkInsight</span>
          </span>
          <span>{t.footerNote}</span>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({
  tone,
  icon,
  title,
  desc,
}: {
  tone: "admin" | "teacher" | "student";
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const tiles = {
    admin: { bg: "var(--role-admin-soft)", fg: "var(--role-admin)", bar: "var(--role-admin)" },
    teacher: { bg: "var(--role-teacher-soft)", fg: "var(--role-teacher)", bar: "var(--role-teacher)" },
    student: { bg: "var(--role-student-soft)", fg: "var(--role-student)", bar: "var(--role-student)" },
  }[tone];
  return (
    <div className="card card-hover card-pad relative overflow-hidden">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: tiles.bar }}
      />
      <span
        className="icon-tile !h-12 !w-12 !rounded-2xl"
        style={{ ["--tile-bg" as string]: tiles.bg, ["--tile-fg" as string]: tiles.fg }}
      >
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-bold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
    </div>
  );
}

/** CSS-only illustration of a results view — no images, no libraries. */
function ProductPreview({ t }: { t: Dictionary }) {
  const bars = [
    { label: "A", v: 82, c: "var(--chart-1)" },
    { label: "B", v: 46, c: "var(--chart-5)" },
    { label: "C", v: 68, c: "var(--chart-3)" },
    { label: "D", v: 91, c: "var(--chart-2)" },
    { label: "E", v: 57, c: "var(--chart-4)" },
  ];
  return (
    <div className="animate-fade-up-delay-2 relative mx-auto w-full max-w-md pb-14 lg:max-w-none" aria-hidden>
      <div className="animate-float rounded-2xl border border-white/30 bg-white/95 p-5 text-[var(--ink)] shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              {t.resultsTitle}
            </p>
            <p className="mt-0.5 text-base font-bold">{t.chartStubTitle}</p>
          </div>
          <span className="badge badge-success badge-dot">{t.jobStatusSucceeded}</span>
        </div>
        <div className="mt-5 flex h-36 items-end gap-3">
          {bars.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-28 w-full items-end">
                <span
                  className="w-full rounded-t-lg"
                  style={{ height: `${b.v}%`, background: b.c }}
                />
              </div>
              <span className="text-[10px] font-semibold text-[var(--muted)]">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { k: t.overallScore, v: "72%", c: "var(--blue-600)" },
            { k: t.strongestTopic, v: "D", c: "var(--emerald-600)" },
            { k: t.weakestTopic, v: "B", c: "var(--rose-600)" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-[var(--surface-sunken)] px-2 py-2.5">
              <p className="text-[10px] font-semibold text-[var(--muted)]">{s.k}</p>
              <p className="display mt-0.5 text-lg" style={{ color: s.c }}>
                {s.v}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 -left-6 hidden rounded-xl border border-white/30 bg-white/95 px-4 py-3 text-[var(--ink)] shadow-lg backdrop-blur sm:block">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
          {t.crossExamWeaknessTitle}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="chip chip--hue" style={{ ["--chip-hue" as string]: 350 }}>
            {t.topicChip} B
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <Icon.TrendingUp size={14} /> +12%
          </span>
        </div>
      </div>
    </div>
  );
}
