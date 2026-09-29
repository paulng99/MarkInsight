"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Icon } from "@/components/ui/icons";
import {
  fillDeleteImpactTemplate,
  matchesDeleteConfirmText,
} from "@/lib/admin/delete-confirm";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Props = {
  t: Dictionary;
  title: string;
  impact: string;
  /** Exact token the admin must type (subject code, class name, or fixed word). */
  confirmToken: string;
  confirmDisabled?: boolean;
  pending?: boolean;
  /** Server rejection copy — dialog stays open when set. */
  errorMessage?: string | null;
  /** When set, shows a prominent 「改為封存」 action. */
  onArchiveInstead?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AdminDeleteDialog({
  t,
  title,
  impact,
  confirmToken,
  confirmDisabled = false,
  pending = false,
  errorMessage = null,
  onArchiveInstead,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const impactId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const canConfirm =
    !confirmDisabled &&
    !pending &&
    matchesDeleteConfirmText(typed, confirmToken);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      inputRef.current?.focus();
      if (document.activeElement !== inputRef.current) {
        const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        first?.focus();
      }
    };
    const timer = window.setTimeout(focusFirst, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!pending) onCancel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = [
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onCancel, pending]);

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && canConfirm) {
      event.preventDefault();
      onConfirm();
    }
  }

  const typePrompt = fillDeleteImpactTemplate(t.adminSubjectsDeleteTypePrompt, {
    token: confirmToken,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={errorMessage ? `${impactId} ${errorId}` : impactId}
        className="card w-full max-w-lg p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span
            className="icon-tile !h-10 !w-10 shrink-0"
            style={{
              ["--tile-bg" as string]: "var(--color-error-soft)",
              ["--tile-fg" as string]: "var(--color-error)",
            }}
          >
            <Icon.Trash size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--ink)]"
            >
              {title}
            </h2>
            <p
              id={impactId}
              className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--ink-secondary)]"
            >
              {impact}
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p
            id={errorId}
            role="alert"
            className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error)]/30 bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]"
          >
            {errorMessage}
          </p>
        ) : null}

        <label className="mt-5 block text-sm font-medium text-[var(--ink)]">
          {typePrompt}
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="input mt-2 w-full"
            value={typed}
            disabled={pending}
            aria-invalid={
              Boolean(errorMessage) || (typed.length > 0 && !canConfirm)
            }
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
        </label>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {t.adminSubjectsDeleteTypeHint}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={onCancel}
          >
            {t.cancel}
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onArchiveInstead ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={onArchiveInstead}
              >
                <Icon.Archive size={16} />
                {t.adminSubjectsDeleteSwitchToArchive}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canConfirm}
              onClick={onConfirm}
            >
              <Icon.Trash size={16} />
              {t.adminSubjectsDeleteConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
