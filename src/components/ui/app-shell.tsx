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
        { href: "/teacher", label: t.navDashboard, icon: <Icon.Home /> },
        { href: "/teacher/exams/new", label: t.examCreate, icon: <Icon.Plus /> },
      ];
    case "STUDENT":
      return [{ href: "/student", label: t.navDashboard, icon: <Icon.Home /> }];
    case "ADMIN":
    default:
      return [
        { href: "/admin", label: t.navOverview, icon: <Icon.Home /> },
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
}: {
  user: ShellUser;
  t: Dictionary;
  locale: Locale;
  compact?: boolean;
}) {
  const tone = roleTone[user.role];
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"}`}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${tone.avatar}`}
        aria-hidden
      >
        {initials(user)}
      </span>
      {compact ? null : (
        <div className="min-w-0 flex-1">
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
 * Role workspace layout: persistent sidebar on large screens, compact
 * top bar + horizontal nav on small screens.
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/80 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <BrandLogo href={home} />
        </div>
        <div className="mt-8 flex-1">
          <p className="mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
            {t.navSectionWorkspace}
          </p>
          <SidebarNav items={items} locale={locale} />
        </div>
        <div className="space-y-3">
          <Suspense fallback={null}>
            <LocaleSwitch locale={locale} className="w-full justify-center" />
          </Suspense>
          <UserBlock user={user} t={t} locale={locale} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 border-b border-[var(--border)] lg:hidden">
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
