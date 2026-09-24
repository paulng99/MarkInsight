import Link from "next/link";

export function BrandMark({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--blue-500),var(--blue-700))] text-white shadow-[var(--shadow-primary)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-8" />
        <path d="M21 8l-5 5-3-3-4 4" opacity={0.9} />
      </svg>
    </span>
  );
}

export function BrandLogo({
  href,
  label = "MarkInsight",
  compact = false,
  inverse = false,
}: {
  href: string;
  label?: string;
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-lg outline-none"
      aria-label={label}
    >
      <BrandMark size={compact ? 30 : 34} />
      {compact ? null : (
        <span
          className={`display text-[1.15rem] leading-none tracking-tight ${
            inverse ? "text-white" : "text-[var(--ink)]"
          }`}
        >
          Mark<span className={inverse ? "text-blue-200" : "text-primary-600"}>Insight</span>
        </span>
      )}
    </Link>
  );
}
