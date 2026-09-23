"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type ExamRow = {
  id: string;
  title: string;
  examDate: string;
  classSubject: { name: string; subjectCode: string };
  submission: {
    id: string;
    status: string;
    latestJob: { id: string; status: string } | null;
  } | null;
};

export function StudentExamList({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      <div className="mt-8 text-sm text-[var(--color-error)]">
        <p>{error}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          {t.settingsRetry}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
        {t.studentNavHome}
      </h2>
      {exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
          {t.examsEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => (
            <li
              key={exam.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 student-exam-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{exam.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {exam.classSubject.name} · {exam.examDate}
                  </p>
                </div>
                {exam.submission ? (
                  <JobStatusBadge status={exam.submission.status} t={t} pulse />
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link
                  href={`/student/exams/${exam.id}/upload?locale=${locale}`}
                  className="font-medium text-[var(--brand)] hover:underline"
                >
                  {t.uploadScriptTitle}
                </Link>
                {exam.submission ? (
                  <Link
                    href={`/student/submissions/${exam.submission.id}?locale=${locale}`}
                    className="font-medium text-[var(--color-accent)] hover:underline"
                  >
                    {t.viewResults}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
