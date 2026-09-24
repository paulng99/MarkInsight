"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

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

const subjectHues = [172, 222, 262, 28, 345, 200];

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

  const subjectCards: SubjectRow[] =
    subjects.length > 0
      ? subjects
      : subjectsFromExams.map((s) => ({ ...s, succeededExamCount: 0, ready: false }));

  const stats = useMemo(() => {
    const list = exams ?? [];
    const uploaded = list.filter((e) => e.submission).length;
    const done = list.filter((e) => e.submission?.status === "DONE").length;
    return {
      exams: list.length,
      uploaded,
      done,
      pending: list.length - uploaded,
    };
  }, [exams]);

  if (exams === null) {
    return (
      <div className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <LoadingBlock label={t.examsLoading} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        tone="error"
        className="mt-8"
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            <Icon.Refresh size={14} />
            {t.settingsRetry}
          </button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <div className="mt-8 space-y-10">
      <div className="animate-fade-up-delay grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t.statExams} value={stats.exams} icon={<Icon.FileText />} tint="teal" />
        <StatCard label={t.uploadedLabel} value={stats.uploaded} icon={<Icon.Upload />} tint="blue" />
        <StatCard label={t.statResultsReady} value={stats.done} icon={<Icon.Award />} tint="emerald" />
        <StatCard label={t.statPendingUpload} value={stats.pending} icon={<Icon.Clock />} tint="amber" />
      </div>

      <section className="animate-fade-up-delay-2 space-y-4">
        <SectionHeader
          icon={<Icon.Layers size={18} />}
          title={t.subjectsTitle}
          description={t.crossExamWeaknessIntro}
        />
        {subjectCards.length === 0 ? (
          <EmptyState icon={<Icon.Layers size={22} />} title={t.studentSubjectsEmpty} compact />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjectCards.map((s, i) => {
              const hue = subjectHues[i % subjectHues.length];
              return (
                <li key={s.id}>
                  <Link
                    href={`/student/subjects/${s.id}?locale=${locale}`}
                    className="card card-hover card-pad group block h-full"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="display flex h-11 w-11 items-center justify-center rounded-xl text-sm"
                        style={{
                          background: `hsl(${hue} 80% 94%)`,
                          color: `hsl(${hue} 60% 32%)`,
                        }}
                      >
                        {s.subjectCode.slice(0, 3)}
                      </span>
                      <span className={`badge ${s.ready ? "badge-success badge-dot" : "badge-neutral"}`}>
                        {s.ready ? t.crossExamReadyBadge : t.crossExamNotReadyBadge}
                      </span>
                    </div>
                    <p className="mt-4 font-bold text-[var(--ink)]">{s.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {s.subjectCode} · {s.succeededExamCount} {t.successfulExams}
                    </p>
                    <div className="progress mt-3 !h-1.5" aria-hidden>
                      <span
                        style={{
                          width: `${Math.min(100, (s.succeededExamCount / 2) * 100)}%`,
                          background: s.ready ? "var(--emerald-500)" : `hsl(${hue} 65% 50%)`,
                        }}
                      />
                    </div>
                    <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                      {t.crossExamWeaknessNav}
                      <Icon.ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="animate-fade-up-delay-3 space-y-4">
        <SectionHeader
          icon={<Icon.FileText size={18} />}
          title={t.studentNavHome}
          description={t.emptyStudent}
        />
        {exams.length === 0 ? (
          <EmptyState icon={<Icon.Inbox size={22} />} title={t.examsEmpty} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {exams.map((exam) => {
              const sub = exam.submission;
              const done = sub?.status === "DONE";
              return (
                <li key={exam.id} className="card card-pad flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--ink)]">{exam.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                        <span className="badge badge-neutral">{exam.classSubject.subjectCode}</span>
                        <span>{exam.classSubject.name}</span>
                        <span className="inline-flex items-center gap-1">
                          <Icon.Calendar size={12} />
                          {exam.examDate}
                        </span>
                      </p>
                    </div>
                    {sub ? (
                      <JobStatusBadge status={sub.status} t={t} pulse />
                    ) : (
                      <span className="badge badge-neutral">{t.statPendingUpload}</span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                    {done && sub ? (
                      <Link
                        href={`/student/submissions/${sub.id}?locale=${locale}`}
                        className="btn btn-primary btn-sm"
                      >
                        <Icon.BarChart size={14} />
                        {t.viewResults}
                      </Link>
                    ) : null}
                    <Link
                      href={`/student/exams/${exam.id}/upload?locale=${locale}`}
                      className={`btn btn-sm ${done ? "btn-secondary" : "btn-primary"}`}
                    >
                      <Icon.Upload size={14} />
                      {t.uploadScriptTitle}
                    </Link>
                    {sub && !done ? (
                      <Link
                        href={`/student/submissions/${sub.id}?locale=${locale}`}
                        className="btn btn-secondary btn-sm"
                      >
                        <Icon.Eye size={14} />
                        {t.viewResults}
                      </Link>
                    ) : null}
                    <Link
                      href={`/student/subjects/${exam.classSubject.id}?locale=${locale}`}
                      className="btn btn-ghost btn-sm"
                    >
                      <Icon.TrendingUp size={14} />
                      {t.crossExamWeaknessNav}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
