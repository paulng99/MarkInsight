"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Alert, LoadingBlock } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";

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
  const [fileReset, setFileReset] = useState(0);
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
      setStudentId((cur) => cur || data.students?.[0]?.studentId || "");
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
        setFileReset((n) => n + 1);
        await load();
      } catch {
        setError(t.uploadError);
      }
    });
  }

  if (allowed === null) {
    return <LoadingBlock label={t.stateLoading} className="mt-8" />;
  }

  if (!allowed) {
    return (
      <div className="mt-8 space-y-4">
        <Alert tone="warn">{t.proxyUploadDisabled}</Alert>
        <Link href={`/teacher/exams/${examId}?locale=${locale}`} className="btn btn-secondary">
          <Icon.ArrowLeft size={16} />
          {t.examBack}
        </Link>
      </div>
    );
  }

  const selected = students.find((s) => s.studentId === studentId);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={onSubmit} className="card card-pad animate-fade-up-delay space-y-5">
        <div>
          <label className="label" htmlFor="proxy-student">
            {t.proxySelectStudent}
          </label>
          <select
            id="proxy-student"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="select"
          >
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.name || s.email}
              </option>
            ))}
          </select>
          {selected?.submission ? (
            <p className="field-hint flex items-center gap-2">
              {t.uploadedLabel}: <JobStatusBadge status={selected.submission.status} t={t} />
            </p>
          ) : (
            <p className="field-hint">{t.noSubmissionYet}</p>
          )}
        </div>

        <FileField
          required
          multiple
          accept="image/*,application/pdf"
          title={t.dropzoneTitle}
          hint={t.uploadMultipleHint}
          selectedLabel={t.fileSelected}
          resetKey={fileReset}
        />

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
          <button type="submit" disabled={pending || !studentId} className="btn btn-primary">
            {pending ? <Icon.Loader size={16} /> : <Icon.Upload size={16} />}
            {pending ? t.uploadUploading : t.uploadSubmit}
          </button>
          {resultId ? (
            <Link
              href={`/teacher/exams/${examId}/results?locale=${locale}&submissionId=${resultId}`}
              className="btn btn-secondary"
            >
              <Icon.BarChart size={16} />
              {t.viewResults}
            </Link>
          ) : null}
          <Link href={`/teacher/exams/${examId}?locale=${locale}`} className="btn btn-ghost">
            <Icon.ArrowLeft size={16} />
            {t.examBack}
          </Link>
        </div>
      </form>

      <aside className="space-y-4 animate-fade-up-delay-2">
        <JobProgressPanel jobId={jobId} t={t} />
        <div className="card card-pad">
          <p className="eyebrow">{t.studentsWithScripts}</p>
          <ul className="mt-3 space-y-2">
            {students.slice(0, 8).map((s) => (
              <li key={s.studentId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--ink)]">{s.name || s.email}</span>
                {s.submission ? (
                  <JobStatusBadge status={s.submission.status} t={t} />
                ) : (
                  <span className="badge badge-neutral">{t.statPendingUpload}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
