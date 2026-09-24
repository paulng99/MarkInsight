"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type ClassSubject = {
  id: string;
  name: string;
  subjectCode: string;
  schoolYearName: string;
};

export function OpenExamForm({
  locale,
  t,
  initialClassSubjectId,
}: {
  locale: Locale;
  t: Dictionary;
  initialClassSubjectId?: string;
}) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSubject[]>([]);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [classSubjectId, setClassSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/workspace");
      const data = await res.json();
      if (res.ok) {
        setClasses(data.classSubjects ?? []);
        const preferred = (data.classSubjects ?? []).find(
          (c: ClassSubject) => c.id === initialClassSubjectId,
        );
        const first = preferred ?? data.classSubjects?.[0];
        if (first) setClassSubjectId(first.id);
      }
    })();
  }, [initialClassSubjectId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, examDate, classSubjectId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.examCreateError);
          return;
        }
        setSuccess(t.examCreateSuccess);
        router.push(`/teacher/exams/${data.exam.id}?locale=${locale}`);
      } catch {
        setError(t.examCreateError);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 max-w-xl space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_40px_rgba(15,63,134,0.06)]"
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">{t.examTitle}</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">{t.examDate}</span>
        <input
          required
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">{t.examClass}</span>
        <select
          required
          value={classSubjectId}
          onChange={(e) => setClassSubjectId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.subjectCode}) · {c.schoolYearName}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-[var(--color-success)] animate-success-pop">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !classSubjectId}
        className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? t.examCreating : t.examCreateSubmit}
      </button>
    </form>
  );
}
