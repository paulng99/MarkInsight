"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match only this exact path (default: prefix match). */
  exact?: boolean;
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({
  items,
  locale,
  variant = "vertical",
}: {
  items: NavItem[];
  locale: string;
  variant?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length);
  const activeHref = sorted.find((i) => isActive(pathname, i))?.href;

  if (variant === "horizontal") {
    return (
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Primary">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={`${item.href}?locale=${locale}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--border)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={`${item.href}?locale=${locale}`}
            aria-current={active ? "page" : undefined}
            className="nav-item"
          >
            <span className="shrink-0 text-[var(--muted)]">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
