"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { ExpandableScoreCards } from "@/components/results/expandable-score-cards";
import { ResultSummary, summarize } from "@/components/results/result-summary";
import { TopicChartStub } from "@/components/results/topic-chart-stub";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/page-header";

type StudentRow = {
  studentId: string;
  name: string | null;
  email: string;
  submission: { id: string; status: string } | null;
};

type SubmissionDetail = {
  id: string;
  status: string;
  errorMessage: string | null;
  scoringLlmModel: string | null;
  questionScores: Array<{
    questionKey: string;
    topic: string;
    itemType: string;
    score: number;
    maxScore: number;
    feedback?: string | null;
  }>;
  aggregates: Array<{
    topic: string;
    itemType: string;
    avgScoreRatio: number;
  }>;
  student: { id: string; name: string | null; email: string };
  exam?: {
    id: string;
    classSubject?: { id: string; name: string };
  };
};

export function TeacherClassResults({
  locale,
  t,
  examId,
  initialSubmissionId,
}: {
  locale: Locale;
  t: Dictionary;
  examId: string;
  initialSubmissionId?: string;
}) {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(
    initialSubmissionId ?? null,
  );
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}/submissions`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || t.stateError);
      setStudents([]);
      return;
    }
    const list = (data.students ?? []) as StudentRow[];
    setStudents(list);
    setSelected((cur) => cur ?? list.find((s) => s.submission)?.submission?.id ?? null);
  }, [examId, t.stateError]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    void (async () => {
      try {
        const res = await fetch(`/api/submissions/${selected}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t.stateError);
          return;
        }
        setDetail(data.submission);
        setError(null);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selected, t.stateError]);

  const chartData =
    detail?.aggregates && detail.aggregates.length > 0
      ? detail.aggregates.map((a) => ({
          topic: `${a.topic}/${a.itemType}`,
          ratio: a.avgScoreRatio,
        }))
      : (detail?.questionScores ?? []).reduce<Array<{ topic: string; ratio: number }>>(
          (acc, q) => {
            const existing = acc.find((x) => x.topic === q.topic);
            const ratio = q.maxScore > 0 ? q.score / q.maxScore : 0;
            if (existing) {
              existing.ratio = (existing.ratio + ratio) / 2;
            } else {
              acc.push({ topic: q.topic, ratio });
            }
            return acc;
          },
          [],
        );

  if (students === null) {
    return <LoadingBlock label={t.stateLoading} className="mt-8" />;
  }

  const withScripts = students.filter((s) => s.submission).length;
  const summary = detail ? summarize(detail.questionScores) : null;

  return (
    <div className="teacher-results mt-8 space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Student list */}
        <aside className="card animate-fade-up-delay self-start overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="eyebrow">{t.studentsWithScripts}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              <span className="font-bold text-[var(--ink)]">{withScripts}</span> / {students.length}
            </p>
          </div>
          {students.length === 0 ? (
            <div className="p-4">
              <EmptyState compact title={t.stateEmpty} />
            </div>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto p-2">
              {students.map((s) => {
                const active = s.submission && selected === s.submission.id;
                return (
                  <li key={s.studentId}>
                    {s.submission ? (
                      <button
                        type="button"
                        onClick={() => setSelected(s.submission!.id)}
                        aria-pressed={Boolean(active)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          active
                            ? "bg-primary-50 text-primary-900 shadow-[inset_3px_0_0_var(--color-primary)]"
                            : "hover:bg-[var(--surface-sunken)]"
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium">{s.name || s.email}</span>
                        <JobStatusBadge status={s.submission.status} t={t} />
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--muted)]">
                        <span className="min-w-0 truncate">{s.name || s.email}</span>
                        <span className="badge badge-neutral">{t.statPendingUpload}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Detail */}
        <div className="min-w-0 space-y-6 animate-fade-up-delay-2">
          {!detail ? (
            loadingDetail ? (
              <LoadingBlock label={t.stateLoading} />
            ) : (
              <EmptyState
                icon={<Icon.Users size={22} />}
                title={t.selectStudent}
                description={withScripts === 0 ? t.stateEmpty : undefined}
              />
            )
          ) : (
            <>
              <div className="card card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{t.resultsTitle}</p>
                    <h2 className="display mt-1 text-xl text-[var(--ink)]">
                      {detail.student.name || detail.student.email}
                    </h2>
                    {detail.scoringLlmModel ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                        <Icon.CheckCircle size={12} />
                        {t.scoringModelStored}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <JobStatusBadge status={detail.status} t={t} pulse />
                    {detail.exam?.classSubject?.id ? (
                      <Link
                        href={`/teacher/class-subjects/${detail.exam.classSubject.id}/students/${detail.student.id}/weakness?locale=${locale}&fromExamId=${examId}`}
                        className="btn btn-secondary btn-sm"
                      >
                        <Icon.TrendingUp size={14} />
                        {t.teacherStudentWeakness}
                      </Link>
                    ) : null}
                  </div>
                </div>
                {detail.status === "FAILED" ? (
                  <Alert tone="error" className="mt-4">
                    {detail.errorMessage || t.stateError} — {t.checkFile}
                  </Alert>
                ) : null}
                {summary && detail.questionScores.length > 0 ? (
                  <ResultSummary summary={summary} t={t} className="mt-5" />
                ) : null}
              </div>

              <div className="card card-pad">
                <TopicChartStub data={chartData} t={t} intensity="medium" />
              </div>

              <div className="card card-pad">
                <SectionHeader
                  icon={<Icon.Layers size={18} />}
                  title={t.expandScores}
                  description={`${detail.questionScores.length} ${t.questionsCount}`}
                  className="mb-4"
                />
                <ExpandableScoreCards scores={detail.questionScores} t={t} colorful={false} />
              </div>
            </>
          )}
        </div>
      </div>

      <Link
        href={`/teacher/exams/${examId}?locale=${locale}`}
        className="link-muted inline-flex items-center gap-1 text-sm"
      >
        <Icon.ArrowLeft size={14} />
        {t.examBack}
      </Link>
    </div>
  );
}
