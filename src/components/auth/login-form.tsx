"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";
import { Alert } from "@/components/ui/feedback";

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

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="error">{t.loginErrorInvalid}</Alert>
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
    </div>
  );
}
