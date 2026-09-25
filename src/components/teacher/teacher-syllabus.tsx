"use client";

import { useCallback, useEffect, useState } from "react";
import { syllabusAssetTitle, uploadExtension } from "@/lib/files/display-name";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type SubjectGroup = {
  subjectCode: string;
  syllabus: {
    originalName: string | null;
    mimeType: string | null;
    updatedAt: string;
  } | null;
};

export function TeacherSyllabus({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [subjects, setSubjects] = useState<SubjectGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
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

  async function onUpload(code: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setNotice(null);
    setPendingCode(code);
    try {
      const res = await fetch(`/api/subjects/${encodeURIComponent(code)}/syllabus`, {
        method: "POST",
        body: new FormData(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || t.uploadError);
        return;
      }
      form.reset();
      setResetKey((n) => n + 1);
      setNotice(t.syllabusUploaded);
      await load();
    } catch {
      setNotice(t.uploadError);
    } finally {
      setPendingCode(null);
    }
  }

  if (!subjects) return <LoadingBlock label={t.settingsLoading} className="mt-8" />;

  return (
    <div className="mt-8 space-y-4">
      <span className="sr-only">locale {locale}</span>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? (
        <Alert tone={notice === t.syllabusUploaded ? "success" : "error"}>{notice}</Alert>
      ) : null}
      {subjects.length === 0 ? (
        <EmptyState title={t.syllabusEmpty} />
      ) : (
        subjects.map((subject) => {
          const pending = pendingCode === subject.subjectCode;
          return (
            <section key={subject.subjectCode} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="icon-tile">
                    <Icon.BookOpen size={18} />
                  </span>
                  <div>
                    <p className="eyebrow">{t.subjectGroup}</p>
                    <h2 className="text-lg font-bold text-[var(--ink)]">{subject.subjectCode}</h2>
                  </div>
                </div>
                <span className={`badge badge-dot ${subject.syllabus ? "badge-success" : "badge-warn"}`}>
                  {subject.syllabus ? t.syllabusTitle : t.syllabusEmpty}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{t.syllabusHint}</p>
              {subject.syllabus ? (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--color-success-soft)] px-3 py-2 text-xs text-[var(--color-success)]">
                  <Icon.CheckCircle size={14} />
                  <span className="truncate font-medium">
                    {syllabusAssetTitle(
                      subject.subjectCode,
                      t.syllabusTitle,
                      uploadExtension(subject.syllabus.originalName, subject.syllabus.mimeType),
                    )}
                  </span>
                  <span className="ml-auto shrink-0 opacity-80">{subject.syllabus.updatedAt}</span>
                </p>
              ) : null}
              <form onSubmit={(e) => void onUpload(subject.subjectCode, e)} className="mt-4 space-y-3">
                <FileField
                  required
                  compact
                  accept="application/pdf,image/*,text/plain"
                  title={t.dropzoneTitle}
                  hint={t.dropzoneHint}
                  selectedLabel={t.fileSelected}
                  resetKey={resetKey}
                />
                <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
                  {pending ? <Icon.Loader size={14} /> : <Icon.Upload size={14} />}
                  {pending
                    ? t.syllabusUploading
                    : subject.syllabus
                      ? t.syllabusReplace
                      : t.syllabusUpload}
                </button>
              </form>
            </section>
          );
        })
      )}
    </div>
  );
}
