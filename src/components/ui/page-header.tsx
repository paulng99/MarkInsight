import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-[var(--ink)]">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "text-[var(--ink)]" : undefined} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {last ? null : <Icon.ChevronRight size={12} className="text-[var(--faint)]" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  crumbs,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`animate-fade-up ${className}`}>
      {crumbs ? <Breadcrumbs items={crumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
          <h1 className="display text-2xl text-[var(--ink)] sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  icon,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-3">
        {icon ? <span className="icon-tile">{icon}</span> : null}
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
