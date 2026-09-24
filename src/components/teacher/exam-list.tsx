"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type ExamRow = {
  id: string;
  title: string;
  examDate: string;
  assetCount: number;
  submissionCount: number;
  latestStructureJob: { id: string; status: string } | null;
};

type ClassGroup = {
  id: string;
  name: string;
  gradeLevel: string | null;
  exams: ExamRow[];
};

type SubjectGroup = {
  subjectCode: string;
  syllabus: {
    originalName: string | null;
    mimeType: string | null;
    updatedAt: string;
  } | null;
  classes: ClassGroup[];
};

export function TeacherExamList({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [subjects, setSubjects] = useState<SubjectGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      await fetch("/api/workspace");
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.examsError);
        setSubjects([]);
        return;
      }
      setSubjects(data.subjects ?? []);
    } catch {
      setError(t.examsError);
      setSubjects([]);
    }
  }, [t.examsError]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSyllabus(subjectCode: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setNotice(null);
    setPendingCode(subjectCode);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/subjects/${encodeURIComponent(subjectCode)}/syllabus`,
          { method: "POST", body: fd },
        );
        const data = await res.json();
        if (!res.ok) {
          setNotice(data.error || t.uploadError);
          return;
        }
        setNotice(t.syllabusUploaded);
        form.reset();
        await load();
      } catch {
        setNotice(t.uploadError);
      } finally {
        setPendingCode(null);
      }
    });
  }

  if (subjects === null) {
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

      {notice ? (
        <p
          className={`text-sm ${
            notice === t.syllabusUploaded
              ? "text-[var(--color-success)]"
              : "text-[var(--color-error)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      {subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
          {t.examsEmpty}
        </p>
      ) : (
        <div className="space-y-8">
          {subjects.map((subject) => (
            <section
              key={subject.subjectCode}
              className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand)]">
                    {t.subjectGroup}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--ink)]">
                    {subject.subjectCode}
                  </h3>
                </div>
              </div>

              <form
                onSubmit={(e) => onSyllabus(subject.subjectCode, e)}
                className="space-y-2 rounded-xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3"
              >
                <p className="text-sm font-medium text-[var(--ink)]">{t.syllabusTitle}</p>
                <p className="text-xs leading-relaxed text-[var(--muted)]">{t.syllabusHint}</p>
                {subject.syllabus ? (
                  <p className="text-sm text-[var(--ink)]">
                    {subject.syllabus.originalName || t.syllabusTitle}
                    <span className="text-[var(--muted)]"> · {subject.syllabus.updatedAt}</span>
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">{t.syllabusEmpty}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    name="file"
                    type="file"
                    required
                    accept="application/pdf,image/*,text/plain"
                    className="block text-sm"
                  />
                  <button
                    type="submit"
                    disabled={pendingCode === subject.subjectCode}
                    className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pendingCode === subject.subjectCode
                      ? t.syllabusUploading
                      : subject.syllabus
                        ? t.syllabusReplace
                        : t.syllabusUpload}
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                {subject.classes.map((cls) => (
                  <div key={cls.id} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[var(--ink)]">
                        <span className="mr-2 text-[var(--muted)]">{t.classGroup}</span>
                        {cls.name}
                      </h4>
                      <Link
                        href={`/teacher/exams/new?locale=${locale}&classSubjectId=${cls.id}`}
                        className="text-sm font-medium text-[var(--brand)] hover:underline"
                      >
                        {t.examCreate}
                      </Link>
                    </div>
                    {cls.exams.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">{t.examsEmpty}</p>
                    ) : (
                      <ul className="space-y-2">
                        {cls.exams.map((exam) => (
                          <li key={exam.id}>
                            <Link
                              href={`/teacher/exams/${exam.id}?locale=${locale}`}
                              className="block rounded-xl border border-[var(--border)] bg-white px-4 py-3 transition-[border-color,box-shadow] duration-[var(--motion-fast)] hover:border-[var(--brand-soft)] hover:shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-[var(--ink)]">{exam.title}</p>
                                  <p className="mt-1 text-sm text-[var(--muted)]">{exam.examDate}</p>
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
