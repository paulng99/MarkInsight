"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type ExamRow = {
  id: string;
  title: string;
  examDate: string;
  sourceExamId: string | null;
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
  const [subjectCode, setSubjectCode] = useState("");
  const [className, setClassName] = useState("");
  const [adding, setAdding] = useState(false);
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

  function onAddSubject(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setAdding(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectCode, className }),
        });
        const data = await res.json();
        if (!res.ok) {
          setNotice(data.error || t.addSubjectError);
          return;
        }
        setSubjectCode("");
        setClassName("");
        setNotice(t.addSubjectSuccess);
        await load();
      } catch {
        setNotice(t.addSubjectError);
      } finally {
        setAdding(false);
      }
    });
  }

  function onSyllabus(code: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setNotice(null);
    setPendingCode(code);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/subjects/${encodeURIComponent(code)}/syllabus`,
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
            notice === t.syllabusUploaded ||
            notice === t.addSubjectSuccess ||
            notice === t.distributeSuccess
              ? "text-[var(--color-success)]"
              : "text-[var(--color-error)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={onAddSubject}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <h3 className="font-semibold text-[var(--ink)]">{t.addSubjectTitle}</h3>
        <p className="text-sm text-[var(--muted)]">{t.addSubjectHint}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t.addSubjectCode}</span>
            <input
              required
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder="PHY"
              className="block w-36 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t.addSubjectClass}</span>
            <input
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="3A"
              className="block w-36 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {adding ? t.addSubjectSaving : t.addSubjectSubmit}
          </button>
        </div>
      </form>

      {subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
          {t.subjectsEmpty}
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

              <DistributeExam
                subject={subject}
                t={t}
                onDone={(message) => {
                  setNotice(message);
                  void load();
                }}
                onError={setNotice}
              />

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
                                  <p className="mt-1 text-sm text-[var(--muted)]">
                                    {exam.examDate}
                                    {exam.sourceExamId ? ` · ${t.distributeCopy}` : ""}
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DistributeExam({
  subject,
  t,
  onDone,
  onError,
}: {
  subject: SubjectGroup;
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const originals = subject.classes.flatMap((cls) =>
    cls.exams
      .filter((exam) => !exam.sourceExamId)
      .map((exam) => ({ ...exam, classId: cls.id, className: cls.name })),
  );
  const [examId, setExamId] = useState(originals[0]?.id ?? "");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const selected = originals.find((exam) => exam.id === examId) ?? originals[0];
  const heldClassIds = new Set<string>();
  if (selected) {
    heldClassIds.add(selected.classId);
    for (const cls of subject.classes) {
      if (cls.exams.some((exam) => exam.sourceExamId === selected.id)) {
        heldClassIds.add(cls.id);
      }
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setPending(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${encodeURIComponent(selected.id)}/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classSubjectIds: classIds }),
        });
        const data = await res.json();
        if (!res.ok) {
          onError(data.error || t.distributeError);
          return;
        }
        setClassIds([]);
        onDone(t.distributeSuccess);
      } catch {
        onError(t.distributeError);
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-[var(--border)] bg-white/70 px-4 py-3"
    >
      <p className="text-sm font-medium text-[var(--ink)]">{t.distributeTitle}</p>
      <p className="text-xs leading-relaxed text-[var(--muted)]">{t.distributeHint}</p>
      {originals.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t.distributeEmpty}</p>
      ) : (
        <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t.distributeExam}</span>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                setExamId(e.target.value);
                setClassIds([]);
              }}
              className="block w-full max-w-md rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            >
              {originals.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} · {exam.className} · {exam.examDate}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">{t.distributeClasses}</legend>
            <div className="flex flex-wrap gap-3">
              {subject.classes.map((cls) => {
                const held = heldClassIds.has(cls.id);
                const checked = held || classIds.includes(cls.id);
                return (
                  <label key={cls.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={held || pending}
                      onChange={(e) => {
                        setClassIds((current) =>
                          e.target.checked
                            ? [...current, cls.id]
                            : current.filter((id) => id !== cls.id),
                        );
                      }}
                    />
                    <span>
                      {cls.name}
                      {held ? `（${t.distributeAlready}）` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={pending || classIds.length === 0}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? t.distributeSaving : t.distributeSubmit}
          </button>
        </>
      )}
    </form>
  );
}
