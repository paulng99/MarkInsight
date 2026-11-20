"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { ClassRoster } from "@/components/teacher/class-roster";
import { Alert, LoadingBlock } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";
import { EXAM_UPLOAD_ACCEPT } from "@/lib/files/exam-upload";

type StudentRow = {
  studentId: string;
  name: string | null;
  email: string;
  pending?: boolean;
  submission: { id: string; status: string } | null;
};

function studentOptionLabel(student: StudentRow, pendingLabel: string): string {
  if (student.pending) return `${student.email} (${pendingLabel})`;
  return student.name?.trim() || student.email;
}

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
  const [archived, setArchived] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [classSubject, setClassSubject] = useState<{ id: string; name: string } | null>(null);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [fileReset, setFileReset] = useState(0);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const [ws, examRes, res] = await Promise.all([
        fetch("/api/workspace"),
        fetch(`/api/exams/${examId}`),
        fetch(`/api/exams/${examId}/submissions`),
      ]);
      const wsData = (await ws.json()) as { allowTeacherUploadOnBehalf?: boolean; error?: string };
      const examData = (await examRes.json()) as {
        error?: string;
        exam?: {
          archived?: boolean;
          classSubject?: { id?: string; name?: string };
        };
      };
      const data = (await res.json()) as { error?: string; students?: StudentRow[] };
      if (!ws.ok) {
        setAllowed(false);
        setError(wsData.error || t.stateError);
      } else {
        setAllowed(Boolean(wsData.allowTeacherUploadOnBehalf));
      }
      if (examRes.ok && examData.exam?.archived) {
        setArchived(true);
      }
      if (examRes.ok && examData.exam?.classSubject?.id) {
        setClassSubject({
          id: examData.exam.classSubject.id,
          name: examData.exam.classSubject.name ?? "",
        });
      }
      if (!res.ok) {
        setStudents([]);
        setStudentId("");
        setError(data.error || t.stateError);
        return;
      }
      const list = data.students ?? [];
      setStudents(list);
      setStudentId((cur) =>
        cur && list.some((student) => student.studentId === cur)
          ? cur
          : (list[0]?.studentId ?? ""),
      );
      if (ws.ok) setError(null);
    } catch {
      setError(t.stateError);
      setAllowed((cur) => (cur === null ? false : cur));
    } finally {
      setStudentsLoaded(true);
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

  if (allowed === null || !studentsLoaded) {
    return <LoadingBlock label={t.stateLoading} className="mt-8" />;
  }

  if (archived) {
    return (
      <div className="mt-8 space-y-4">
        <Alert tone="warn">{t.classArchivedBanner}</Alert>
        <Link href={`/teacher/exams/${examId}?locale=${locale}`} className="btn btn-secondary">
          <Icon.ArrowLeft size={16} />
          {t.examBack}
        </Link>
      </div>
    );
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
      <div className="space-y-5">
        <form onSubmit={onSubmit} className="card card-pad animate-fade-up-delay space-y-5">
        <div>
          <label className="label" htmlFor="proxy-student">
            {t.proxySelectStudent}
          </label>
          <select
            id="proxy-student"
            required={students.length > 0}
            disabled={students.length === 0}
            value={students.length === 0 ? "" : studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="select"
          >
            {students.length === 0 ? (
              <option value="">{t.rosterEmpty}</option>
            ) : (
              students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {studentOptionLabel(s, t.rosterPendingStatus)}
                </option>
              ))
            )}
          </select>
          {students.length === 0 ? (
            <p className="field-hint">{t.proxyNoStudents}</p>
          ) : selected?.submission ? (
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
          accept={EXAM_UPLOAD_ACCEPT}
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
        {classSubject ? (
          <ClassRoster
            classSubjectId={classSubject.id}
            className={classSubject.name}
            t={t}
            locale={locale}
            initialOpen={students.length === 0}
            onUpdated={() => {
              void load();
            }}
          />
        ) : null}
      </div>

      <aside className="space-y-4 animate-fade-up-delay-2">
        <JobProgressPanel jobId={jobId} t={t} />
        <div className="card card-pad">
          <p className="eyebrow">{t.studentsWithScripts}</p>
          {students.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{t.rosterEmpty}</p>
          ) : (
          <ul className="mt-3 space-y-2">
            {students.slice(0, 8).map((s) => (
              <li key={s.studentId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--ink)]">{studentOptionLabel(s, t.rosterPendingStatus)}</span>
                {s.submission ? (
                  <JobStatusBadge status={s.submission.status} t={t} />
                ) : s.pending ? (
                  <span className="badge badge-info">{t.rosterPendingStatus}</span>
                ) : (
                  <span className="badge badge-neutral">{t.statPendingUpload}</span>
                )}
              </li>
            ))}
          </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
