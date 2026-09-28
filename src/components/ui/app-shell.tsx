import { Suspense, type ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { Role } from "@/lib/roles";
import { BrandLogo } from "./brand-logo";
import { Icon } from "./icons";
import { LocaleSwitch } from "./locale-switch";
import { SidebarNav, type NavItem } from "./sidebar-nav";

type ShellUser = {
  email?: string | null;
  name?: string | null;
  role: Role;
};

const roleTone: Record<Role, { badge: string; avatar: string; label: keyof Dictionary }> = {
  ADMIN: { badge: "badge-violet", avatar: "bg-[var(--role-admin)]", label: "roleAdminLabel" },
  TEACHER: { badge: "badge-info", avatar: "bg-[var(--role-teacher)]", label: "roleTeacherLabel" },
  STUDENT: { badge: "badge-teal", avatar: "bg-[var(--role-student)]", label: "roleStudentLabel" },
};

function navFor(role: Role, t: Dictionary): NavItem[] {
  switch (role) {
    case "TEACHER":
      return [
        { href: "/teacher", label: t.navDashboard, icon: <Icon.Home />, exact: true },
        { href: "/teacher/archive", label: t.navArchive, icon: <Icon.Archive /> },
        { href: "/teacher/classes", label: t.navClasses, icon: <Icon.Users /> },
        { href: "/teacher/syllabus", label: t.syllabusTitle, icon: <Icon.BookOpen /> },
        { href: "/teacher/exams/new", label: t.examCreate, icon: <Icon.Plus /> },
      ];
    case "STUDENT":
      return [{ href: "/student", label: t.navDashboard, icon: <Icon.Home /> }];
    case "ADMIN":
    default:
      return [
        { href: "/admin", label: t.navOverview, icon: <Icon.Home />, exact: true },
        { href: "/admin/prompts", label: t.settingsSectionPrompts, icon: <Icon.Sparkles /> },
        { href: "/admin/settings", label: t.settingsTitle, icon: <Icon.Settings /> },
      ];
  }
}

function initials(user: ShellUser) {
  const source = user.name?.trim() || user.email || "?";
  const parts = source.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function UserBlock({
  user,
  t,
  locale,
  compact = false,
  rail = false,
}: {
  user: ShellUser;
  t: Dictionary;
  locale: Locale;
  compact?: boolean;
  /** Icon rail below 1400px; full name from desktop width up. */
  rail?: boolean;
}) {
  const tone = roleTone[user.role];
  return (
    <div
      className={`flex items-center gap-3 ${
        compact
          ? ""
          : `rounded-xl border border-[var(--border)] bg-[var(--surface)] ${
              rail
                ? "flex-col px-1.5 py-2 min-[1400px]:flex-row min-[1400px]:p-3"
                : "p-3"
            }`
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${tone.avatar}`}
        aria-hidden
      >
        {initials(user)}
      </span>
      {compact ? null : (
        <div className={`min-w-0 flex-1 ${rail ? "hidden min-[1400px]:block" : ""}`}>
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {user.name || user.email}
          </p>
          <span className={`badge ${tone.badge} mt-0.5`}>{t[tone.label]}</span>
        </div>
      )}
      <form action={logoutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="btn btn-ghost btn-sm !px-2"
          title={t.signOut}
          aria-label={t.signOut}
        >
          <Icon.LogOut size={16} />
        </button>
      </form>
    </div>
  );
}

/**
 * Role workspace layout.
 * Phone: top bar + horizontal nav.
 * iPad widths (768–1399px): icon-only sidebar.
 * Desktop (1400px+): labeled sidebar.
 */
export function AppShell({
  user,
  locale,
  t,
  children,
  navItems,
}: {
  user: ShellUser;
  locale: Locale;
  t: Dictionary;
  children: ReactNode;
  navItems?: NavItem[];
}) {
  const items = navItems ?? navFor(user.role, t);
  const home = `/${user.role.toLowerCase()}?locale=${locale}`;

  return (
    <div className="page-bg flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-[4.5rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/80 px-2 py-4 backdrop-blur md:flex min-[1400px]:w-64 min-[1400px]:px-4 min-[1400px]:py-5">
        <div className="flex justify-center min-[1400px]:justify-start min-[1400px]:px-2">
          <BrandLogo href={home} wordmarkClassName="hidden min-[1400px]:inline" />
        </div>
        <div className="mt-6 flex-1 min-[1400px]:mt-8">
          <p className="mb-2 hidden px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--faint)] min-[1400px]:block">
            {t.navSectionWorkspace}
          </p>
          <SidebarNav items={items} locale={locale} />
        </div>
        <div className="flex flex-col items-center gap-3 min-[1400px]:items-stretch">
          <Suspense fallback={null}>
            <LocaleSwitch
              locale={locale}
              className="justify-center max-[1399px]:flex-col min-[1400px]:w-full"
            />
          </Suspense>
          <UserBlock user={user} t={t} locale={locale} rail />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 border-b border-[var(--border)] md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <BrandLogo href={home} />
            <div className="flex items-center gap-2">
              <Suspense fallback={null}>
                <LocaleSwitch locale={locale} />
              </Suspense>
              <UserBlock user={user} t={t} locale={locale} compact />
            </div>
          </div>
          <div className="px-4 pb-3">
            <SidebarNav items={items} locale={locale} variant="horizontal" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
