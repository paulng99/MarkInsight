"use client";

import { useFormStatus } from "react-dom";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";

function SubmitButton({ t }: { t: Dictionary }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
      {pending ? <Icon.Loader size={18} /> : <Icon.ArrowRight size={18} />}
      {t.registerSubmit}
    </button>
  );
}

export function RegisterForm({
  action,
  locale,
  t,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="name" className="label">
          {t.registerName}
        </label>
        <input id="name" name="name" required autoComplete="name" className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          {t.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder={t.addStudentsPlaceholder}
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          {t.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          {t.confirmPassword}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <SubmitButton t={t} />
    </form>
  );
}
