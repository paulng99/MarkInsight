"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";
import { Alert } from "@/components/ui/feedback";

const demoAccounts = [
  { email: "admin@example.com", roleKey: "roleAdminLabel", tone: "badge-violet", avatar: "bg-[var(--role-admin)]" },
  { email: "teacher@example.com", roleKey: "roleTeacherLabel", tone: "badge-info", avatar: "bg-[var(--role-teacher)]" },
  { email: "student@example.com", roleKey: "roleStudentLabel", tone: "badge-teal", avatar: "bg-[var(--role-student)]" },
] as const;

function SubmitButton({ t }: { t: Dictionary }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
      {pending ? <Icon.Loader size={18} /> : <Icon.ArrowRight size={18} />}
      {t.submit}
    </button>
  );
}

export function LoginForm({
  action,
  locale,
  t,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: Locale;
  t: Dictionary;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function fill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password");
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="error">
          {error === "Configuration" || error === "MissingSecret" || error === "UntrustedHost"
            ? t.loginErrorConfig
            : t.loginErrorInvalid}
        </Alert>
      ) : null}

      <form action={action} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label htmlFor="email" className="label">
            {t.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="input"
            placeholder="you@school.edu.hk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            {t.password}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="input pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <Icon.Eye size={16} />
            </button>
          </div>
        </div>
        <SubmitButton t={t} />
      </form>

      <p className="text-center text-sm text-[var(--muted)]">
        {t.registerNeedAccount}{" "}
        <Link href={`/register?locale=${locale}`} className="link font-semibold">
          {t.registerLink}
        </Link>
      </p>

      <div>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">
            {t.demoTitle}
          </span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{t.demoHint}</p>
        <ul className="mt-3 grid gap-2">
          {demoAccounts.map((acc) => {
            const selected = email === acc.email;
            return (
              <li key={acc.email}>
                <button
                  type="button"
                  onClick={() => fill(acc.email)}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-primary-300 bg-primary-50"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${acc.avatar}`}
                    aria-hidden
                  >
                    {acc.email[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                      {acc.email}
                    </span>
                    <span className={`badge ${acc.tone} mt-0.5`}>{t[acc.roleKey]}</span>
                  </span>
                  <span className="text-xs font-semibold text-primary-600">
                    {selected ? <Icon.Check size={16} /> : t.demoFill}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
