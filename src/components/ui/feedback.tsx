import type { ReactNode } from "react";
import { Icon } from "./icons";

type Tone = "success" | "error" | "warn" | "info";

const toneIcon: Record<Tone, (p: { size?: number; className?: string }) => ReactNode> = {
  success: (p) => <Icon.CheckCircle {...p} />,
  error: (p) => <Icon.AlertCircle {...p} />,
  warn: (p) => <Icon.AlertCircle {...p} />,
  info: (p) => <Icon.Info {...p} />,
};

export function Alert({
  tone,
  children,
  action,
  className = "",
  role,
}: {
  tone: Tone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      className={`alert alert-${tone} ${tone === "success" ? "animate-success-pop" : ""} ${className}`}
      role={role ?? (tone === "error" ? "alert" : "status")}
    >
      <span className="mt-0.5 shrink-0">{toneIcon[tone]({ size: 18 })}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`card-muted flex flex-col items-center justify-center text-center ${
        compact ? "px-5 py-8" : "px-6 py-12"
      } ${className}`}
    >
      {icon ? (
        <span className="icon-tile mb-3 !h-12 !w-12 !rounded-2xl">{icon}</span>
      ) : null}
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({
  label,
  lines = 3,
  className = "",
}: {
  label: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-16 w-full"
          style={{ opacity: 1 - i * 0.18 }}
        />
      ))}
    </div>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
      <Icon.Loader size={16} />
      {label}
    </span>
  );
}
