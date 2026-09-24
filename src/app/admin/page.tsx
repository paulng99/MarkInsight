import Link from "next/link";
import { AppShell } from "@/components/ui/app-shell";
import { Icon } from "@/components/ui/icons";
import {
  getDictionary,
  parseLocale,
  requireRolePage,
} from "@/components/workspace-chrome";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const params = await searchParams;
  const locale = parseLocale(params.locale);
  const t = getDictionary(locale);
  const session = await requireRolePage("ADMIN", locale, "/admin");
  const user = session.user;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "";
  const settingsHref = `/admin/settings?locale=${locale}`;

  const checklist = [t.adminCheck1, t.adminCheck2, t.adminCheck3, t.adminCheck4];

  return (
    <AppShell user={user} locale={locale} t={t}>
      <section className="role-hero role-hero--admin animate-fade-up px-6 py-7 sm:px-8 sm:py-9">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-100/90">
              {t.adminShell}
            </p>
            <h1 className="display mt-2 text-2xl sm:text-3xl">
              {t.welcomeBack}
              {displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-violet-50/90 sm:text-base">{t.emptyAdmin}</p>
          </div>
          <Link href={settingsHref} className="btn btn-inverse">
            <Icon.Settings size={18} />
            {t.settingsTitle}
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4 sm:grid-cols-2 animate-fade-up-delay">
          <Link href={settingsHref} className="card card-hover card-pad group flex flex-col">
            <span
              className="icon-tile !h-12 !w-12 !rounded-2xl"
              style={{ ["--tile-bg" as string]: "var(--role-admin-soft)", ["--tile-fg" as string]: "var(--role-admin)" }}
            >
              <Icon.School size={22} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">{t.settingsTitle}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-[var(--muted)]">{t.adminCardSettingsDesc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
              {t.manage}
              <Icon.ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link href={`${settingsHref}#teachers`} className="card card-hover card-pad group flex flex-col">
            <span className="icon-tile !h-12 !w-12 !rounded-2xl">
              <Icon.Users size={22} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">{t.settingsSectionTeachers}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-[var(--muted)]">{t.adminCardTeachersDesc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
              {t.manage}
              <Icon.ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <aside className="card card-pad animate-fade-up-delay-2">
          <p className="eyebrow">{t.adminChecklist}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.adminOverviewIntro}</p>
          <ol className="mt-4 space-y-3">
            {checklist.map((item, i) => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--role-admin-soft)] text-xs font-bold text-[var(--role-admin)]">
                  {i + 1}
                </span>
                <span className="text-[var(--ink-secondary)]">{item}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}
