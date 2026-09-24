"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * Segmented locale toggle that preserves the current path and other query
 * params. Renders as links so it works without JS and is crawlable.
 */
export function LocaleSwitch({
  locale,
  inverse = false,
  className = "",
}: {
  locale: Locale;
  inverse?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(next: Locale) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("locale", next);
    return `${pathname}?${params.toString()}`;
  }

  const options: Array<{ value: Locale; label: string }> = [
    { value: "zh-HK", label: "繁" },
    { value: "en", label: "EN" },
  ];

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center rounded-full p-0.5 text-xs font-semibold ${
        inverse ? "bg-white/15" : "border border-[var(--border)] bg-[var(--surface)]"
      } ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === locale;
        return (
          <Link
            key={opt.value}
            href={hrefFor(opt.value)}
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-2.5 py-1 transition-colors duration-[var(--motion-fast)] ${
              active
                ? inverse
                  ? "bg-white text-primary-700 shadow-sm"
                  : "bg-primary-600 text-white shadow-sm"
                : inverse
                  ? "text-white/80 hover:text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
