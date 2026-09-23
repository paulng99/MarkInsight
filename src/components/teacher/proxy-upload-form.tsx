"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";

type StudentRow = {
  studentId: string;
  name: string | null;
  email: string;
  submission: { id: string; status: string } | null;
};

export function ProxyUploadForm({
  locale,
  t,
  examId,
}: {
  locale: Locale;
  t: Dictionary;
  examId: string;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const ws = await fetch("/api/workspace");
    const wsData = await ws.json();
    if (ws.ok) {
      setAllowed(Boolean(wsData.allowTeacherUploadOnBehalf));
    }
    const res = await fetch(`/api/exams/${examId}/submissions`);
    const data = await res.json();
    if (res.ok) {
      setStudents(data.students ?? []);
      if (data.students?.[0]) setStudentId(data.students[0].studentId);
    } else {
      setError(data.error || t.stateError);
    }
  }, [examId, t.stateError]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("studentId", studentId);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/submissions`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.uploadError);
          return;
        }
        setSuccess(t.uploadSuccess);
        setJobId(data.job?.jobId ?? null);
        setResultId(data.submission?.id ?? null);
        form.reset();
        await load();
      } catch {
        setError(t.uploadError);
      }
    });
  }

  if (allowed === null) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.stateLoading}</p>;
  }

  if (!allowed) {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-[var(--color-warn)]">{t.proxyUploadDisabled}</p>
        <Link
          href={`/teacher/exams/${examId}?locale=${locale}`}
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          {t.examBack}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">{t.proxySelectStudent}</span>
          <select
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2"
          >
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.name || s.email}
                {s.submission ? ` (${s.submission.status})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">{t.uploadChooseFile}</span>
          <input
            name="file"
            type="file"
            required
            accept="image/*,application/pdf"
            className="block"
          />
        </label>
        <p className="text-xs text-[var(--muted)]">{t.examUploadHint}</p>
        {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
        {success ? (
          <p className="text-sm text-[var(--color-success)]">{success}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !studentId}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? t.uploadUploading : t.uploadSubmit}
        </button>
      </form>

      <JobProgressPanel jobId={jobId} t={t} />

      {resultId ? (
        <Link
          href={`/teacher/exams/${examId}/results?locale=${locale}&submissionId=${resultId}`}
          className="inline-block text-sm font-medium text-[var(--brand)] hover:underline"
        >
          {t.viewResults}
        </Link>
      ) : null}

      <Link
        href={`/teacher/exams/${examId}?locale=${locale}`}
        className="inline-block text-sm text-[var(--muted)] hover:underline"
      >
        {t.examBack}
      </Link>
    </div>
  );
}
