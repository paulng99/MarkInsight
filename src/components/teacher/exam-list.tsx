"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type ExamRow = {
  id: string;
  title: string;
  examDate: string;
  classSubject: { id: string; name: string; subjectCode: string };
  assetCount: number;
  submissionCount: number;
  latestStructureJob: { id: string; status: string } | null;
};

export function TeacherExamList({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await fetch("/api/workspace");
      const res = await fetch("/api/exams");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.examsError);
        setExams([]);
        return;
      }
      setExams(data.exams);
    } catch {
      setError(t.examsError);
      setExams([]);
    }
  }, [t.examsError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (exams === null) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.examsLoading}</p>;
  }

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-[var(--color-error)]/30 bg-[color-mix(in_srgb,var(--color-error)_8%,white)] px-4 py-4 text-sm text-[var(--color-error)]">
        <p>{error}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          {t.settingsRetry}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {t.examsListTitle}
        </h2>
        <Link
          href={`/teacher/exams/new?locale=${locale}`}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform duration-[var(--motion-fast)] hover:-translate-y-0.5"
        >
          {t.examCreate}
        </Link>
      </div>

      {exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
          {t.examsEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/teacher/exams/${exam.id}?locale=${locale}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-[border-color,box-shadow] duration-[var(--motion-fast)] hover:border-[var(--brand-soft)] hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--ink)]">{exam.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {exam.classSubject.name} · {exam.examDate}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      assets {exam.assetCount} · submissions {exam.submissionCount}
                    </p>
                  </div>
                  {exam.latestStructureJob ? (
                    <JobStatusBadge status={exam.latestStructureJob.status} t={t} />
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
