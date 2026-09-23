"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type ExamRow = {
  id: string;
  title: string;
  examDate: string;
  classSubject: { id: string; name: string; subjectCode: string };
  submission: {
    id: string;
    status: string;
    latestJob: { id: string; status: string } | null;
  } | null;
};

type SubjectRow = {
  id: string;
  name: string;
  subjectCode: string;
  succeededExamCount: number;
  ready: boolean;
};

export function StudentExamList({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await fetch("/api/workspace");
      const [examsRes, subjectsRes] = await Promise.all([
        fetch("/api/exams"),
        fetch("/api/student/subjects"),
      ]);
      const examsData = await examsRes.json();
      const subjectsData = await subjectsRes.json();
      if (!examsRes.ok) {
        setError(examsData.error || t.examsError);
        setExams([]);
        return;
      }
      setExams(examsData.exams);
      if (subjectsRes.ok) {
        setSubjects(subjectsData.subjects ?? []);
      }
    } catch {
      setError(t.examsError);
      setExams([]);
    }
  }, [t.examsError]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjectsFromExams = useMemo(() => {
    if (!exams) return [];
    const map = new Map<string, { id: string; name: string; subjectCode: string }>();
    for (const e of exams) {
      map.set(e.classSubject.id, e.classSubject);
    }
    return [...map.values()];
  }, [exams]);

  const subjectCards =
    subjects.length > 0
      ? subjects
      : subjectsFromExams.map((s) => ({
          ...s,
          succeededExamCount: 0,
          ready: false,
        }));

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
    <div className="mt-8 space-y-10">
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {t.subjectsTitle}
        </h2>
        {subjectCards.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
            {t.subjectsEmpty}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {subjectCards.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 student-exam-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {s.subjectCode}
                      {"succeededExamCount" in s
                        ? ` · ${t.crossExamExamCount}: ${s.succeededExamCount}`
                        : null}
                    </p>
                  </div>
                  <Link
                    href={`/student/subjects/${s.id}?locale=${locale}`}
                    className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    {t.crossExamWeaknessNav}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {t.studentNavHome}
        </h2>
        {exams.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
            {t.examsEmpty}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
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
                  <Link
                    href={`/student/subjects/${exam.classSubject.id}?locale=${locale}`}
                    className="font-medium text-[var(--muted)] hover:underline"
                  >
                    {t.crossExamWeaknessNav}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
