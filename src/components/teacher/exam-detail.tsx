"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

type ExamDetail = {
  id: string;
  title: string;
  examDate: string;
  classSubject: { id: string; name: string; subjectCode: string };
  structureLlmModel: string | null;
  assets: Array<{
    id: string;
    kind: string;
    originalName: string | null;
    mimeType: string | null;
  }>;
  latestStructureJobs: Array<{
    id: string;
    status: string;
    errorMessage: string | null;
  }>;
};

export function TeacherExamDetail({
  locale,
  t,
  examId,
}: {
  locale: Locale;
  t: Dictionary;
  examId: string;
}) {
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadKind, setUploadKind] = useState<"QUESTION_PAPER" | "ANSWER_KEY">(
    "QUESTION_PAPER",
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/${examId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.stateError);
        return;
      }
      setExam(data.exam);
      setJobId(data.exam.latestStructureJobs?.[0]?.id ?? null);
      setError(null);
    } catch {
      setError(t.stateError);
    }
  }, [examId, t.stateError]);

  useEffect(() => {
    void load();
  }, [load]);

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("kind", uploadKind);
    setBanner(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/assets`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner(data.error || t.uploadError);
          return;
        }
        setBanner(t.uploadSuccess);
        form.reset();
        await load();
      } catch {
        setBanner(t.uploadError);
      }
    });
  }

  function startAnalyze() {
    setBanner(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/analyze`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner(data.error || t.examAnalyzeError);
          return;
        }
        setJobId(data.jobId);
        setBanner(t.examAnalyzeSuccess);
        await load();
      } catch {
        setBanner(t.examAnalyzeError);
      }
    });
  }

  async function retryJob() {
    if (!jobId) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setJobId(data.jobId);
      setBanner(t.examAnalyzeSuccess);
    } else {
      setBanner(data.error || t.examAnalyzeError);
    }
  }

  if (error && !exam) {
    return (
      <div className="mt-8 text-sm text-[var(--color-error)]">
        <p>{error}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          {t.settingsRetry}
        </button>
      </div>
    );
  }

  if (!exam) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.stateLoading}</p>;
  }

  return (
    <div className="mt-8 space-y-8">
      <div>
        <p className="text-sm text-[var(--muted)]">
          {exam.classSubject.name} · {exam.examDate}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
          {exam.title}
        </h2>
        {exam.structureLlmModel ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {t.structureModelStored}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold text-[var(--ink)]">{t.examAssetsTitle}</h3>
        <p className="text-sm text-[var(--muted)]">{t.examUploadHint}</p>
        {exam.assets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t.examAssetsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {exam.assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span>
                  {a.kind}: {a.originalName || a.id}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t.uploadChooseFile}</span>
            <input
              name="file"
              type="file"
              required
              accept="image/*,application/pdf"
              className="block text-sm"
            />
          </label>
          <select
            value={uploadKind}
            onChange={(e) =>
              setUploadKind(e.target.value as "QUESTION_PAPER" | "ANSWER_KEY")
            }
            className="rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
          >
            <option value="QUESTION_PAPER">{t.examUploadPaper}</option>
            <option value="ANSWER_KEY">{t.examUploadKey}</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? t.uploadUploading : t.uploadSubmit}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startAnalyze}
            disabled={pending || exam.assets.length === 0}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? t.examAnalyzing : t.examAnalyze}
          </button>
          {exam.latestStructureJobs[0] ? (
            <JobStatusBadge status={exam.latestStructureJobs[0].status} t={t} pulse />
          ) : null}
        </div>
        <JobProgressPanel
          jobId={jobId}
          t={t}
          onRetry={() => void retryJob()}
          successHint={t.examAnalyzeSuccess}
        />
      </section>

      {banner ? (
        <p
          className={`text-sm ${
            banner === t.uploadSuccess || banner === t.examAnalyzeSuccess
              ? "text-[var(--color-success)]"
              : "text-[var(--color-error)]"
          }`}
        >
          {banner}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/teacher/exams/${examId}/upload?locale=${locale}`}
          className="font-medium text-[var(--brand)] hover:underline"
        >
          {t.proxyUploadTitle}
        </Link>
        <Link
          href={`/teacher/exams/${examId}/results?locale=${locale}`}
          className="font-medium text-[var(--brand)] hover:underline"
        >
          {t.classResults}
        </Link>
        <Link
          href={`/teacher?locale=${locale}`}
          className="font-medium text-[var(--muted)] hover:underline"
        >
          {t.examBack}
        </Link>
      </div>
    </div>
  );
}
