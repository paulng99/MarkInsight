"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

type ClassSubject = {
  id: string;
  name: string;
  subjectCode: string;
  schoolYearName: string;
};

export function OpenExamForm({
  locale,
  t,
  initialClassSubjectId,
}: {
  locale: Locale;
  t: Dictionary;
  initialClassSubjectId?: string;
}) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSubject[] | null>(null);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [classSubjectId, setClassSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/workspace");
        const data = await res.json();
        if (res.ok) {
          const list: ClassSubject[] = data.classSubjects ?? [];
          setClasses(list);
          const preferred = list.find((c) => c.id === initialClassSubjectId);
          const first = preferred ?? list[0];
          if (first) setClassSubjectId(first.id);
        } else {
          setClasses([]);
        }
      } catch {
        setClasses([]);
      }
    })();
  }, [initialClassSubjectId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, examDate, classSubjectId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.examCreateError);
          return;
        }
        setSuccess(t.examCreateSuccess);
        router.push(`/teacher/exams/${data.exam.id}?locale=${locale}`);
      } catch {
        setError(t.examCreateError);
      }
    });
  }

  const selected = classes?.find((c) => c.id === classSubjectId);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={onSubmit} className="card card-pad animate-fade-up-delay space-y-5">
        {classes !== null && classes.length === 0 ? (
          <EmptyState
            icon={<Icon.Layers size={22} />}
            title={t.subjectsEmpty}
            description={t.addSubjectHint}
            action={
              <Link href={`/teacher?locale=${locale}`} className="btn btn-primary btn-sm">
                <Icon.Plus size={14} />
                {t.addSubjectTitle}
              </Link>
            }
          />
        ) : null}

        <div>
          <label className="label" htmlFor="exam-title">
            {t.examTitle}
          </label>
          <input
            id="exam-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder={locale === "en" ? "e.g. Mid-term Test 1" : "例如：上學期測驗一"}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="exam-date">
              {t.examDate}
            </label>
            <input
              id="exam-date"
              required
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="exam-class">
              {t.examClass}
            </label>
            <select
              id="exam-class"
              required
              value={classSubjectId}
              onChange={(e) => setClassSubjectId(e.target.value)}
              className="select"
              disabled={classes === null || classes.length === 0}
            >
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subjectCode}) · {c.schoolYearName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
          <button type="submit" disabled={pending || !classSubjectId} className="btn btn-primary">
            {pending ? <Icon.Loader size={16} /> : <Icon.Plus size={16} />}
            {pending ? t.examCreating : t.examCreateSubmit}
          </button>
          <Link href={`/teacher?locale=${locale}`} className="btn btn-ghost">
            {t.cancel}
          </Link>
        </div>
      </form>

      <aside className="space-y-4 animate-fade-up-delay-2">
        <div className="card card-pad">
          <p className="eyebrow">{t.examInfo}</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="icon-tile !h-8 !w-8">
                <Icon.FileText size={14} />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-[var(--muted)]">{t.examTitle}</dt>
                <dd className="truncate font-semibold text-[var(--ink)]">{title || "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="icon-tile !h-8 !w-8">
                <Icon.Calendar size={14} />
              </span>
              <div>
                <dt className="text-xs text-[var(--muted)]">{t.dateLabel}</dt>
                <dd className="font-semibold tabular-nums text-[var(--ink)]">{examDate}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="icon-tile !h-8 !w-8">
                <Icon.Users size={14} />
              </span>
              <div>
                <dt className="text-xs text-[var(--muted)]">{t.examClass}</dt>
                <dd className="font-semibold text-[var(--ink)]">
                  {selected ? `${selected.name} · ${selected.subjectCode}` : "—"}
                </dd>
              </div>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5 text-sm text-primary-900">
          <p className="flex items-center gap-2 font-semibold">
            <Icon.Info size={16} className="text-primary-600" />
            {t.nextStep}
          </p>
          <p className="mt-1.5 leading-relaxed">{t.nextStepUploadPaper}</p>
        </div>
      </aside>
    </div>
  );
}
