"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { countLabel, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { ExpandableScoreCards } from "@/components/results/expandable-score-cards";
import { StudyFocusCard } from "@/components/results/study-report";
import { ResultSummary, summarize, topicRatios } from "@/components/results/result-summary";
import { TopicChartStub } from "@/components/results/topic-chart-stub";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/page-header";

type SubmissionDetail = {
  id: string;
  status: string;
  errorMessage: string | null;
  scoringLlmModel: string | null;
  studyFocusZh?: string | null;
  studyFocusEn?: string | null;
  exam: {
    id: string;
    title: string;
    examDate: string;
    archived?: boolean;
    classSubject: { id: string; name: string };
  };
  questionScores: Array<{
    questionKey: string;
    topic: string;
    itemType: string;
    score: number;
    maxScore: number;
    feedback?: string | null;
    didWellZh?: string | null;
    didWellEn?: string | null;
    weaknessZh?: string | null;
    weaknessEn?: string | null;
    mistakesToWatchZh?: string | null;
    mistakesToWatchEn?: string | null;
    howToImproveZh?: string | null;
    howToImproveEn?: string | null;
  }>;
  aggregates: Array<{
    topic: string;
    itemType: string;
    avgScoreRatio: number;
  }>;
  jobs: Array<{ id: string; status: string; errorMessage: string | null }>;
};

const liveStatuses = new Set(["QUEUED", "PENDING", "ANALYZING"]);

export function StudentResultView({
  locale,
  t,
  submissionId,
}: {
  locale: Locale;
  t: Dictionary;
  submissionId: string;
}) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/submissions/${submissionId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.stateError);
        return;
      }
      setDetail(data.submission);
      setError(null);
    } catch {
      setError(t.stateError);
    } finally {
      setLoading(false);
    }
  }, [submissionId, t.stateError]);

  const live = detail ? liveStatuses.has(detail.status) : true;

  useEffect(() => {
    void load();
    if (!live) return;
    const id = window.setInterval(() => {
      void load();
    }, 2000);
    return () => window.clearInterval(id);
  }, [load, live]);

  async function retry() {
    const res = await fetch(`/api/submissions/${submissionId}/analyze`, {
      method: "POST",
    });
    if (res.ok) await load();
  }

  if (loading && !detail) {
    return (
      <div className="mt-8 space-y-6">
        <div className="skeleton h-32" />
        <LoadingBlock label={t.stateLoading} />
      </div>
    );
  }

  if (error && !detail) {
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
        {error || t.stateError}
      </Alert>
    );
  }

  if (!detail) {
    return <EmptyState className="mt-8" title={t.stateEmpty} />;
  }

  // Subject aggregates are keyed by topic + item type (and span several exams),
  // so this attempt's chart is built from its own question scores, weighted by marks.
  const chartData = topicRatios(detail.questionScores);

  const summary = summarize(detail.questionScores);
  const done = detail.status === "DONE";
  const archived = detail.exam.archived === true;

  return (
    <div className="student-results mt-8 space-y-6">
      <section className="role-hero role-hero--student animate-fade-up px-6 py-6 sm:px-8">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-50/90">
              {detail.exam.classSubject.name} · {detail.exam.examDate}
            </p>
            <h2 className="display mt-1.5 text-2xl">{detail.exam.title}</h2>
            {detail.scoringLlmModel ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-teal-50/80">
                <Icon.CheckCircle size={12} />
                {t.scoringModelStored}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={detail.status} t={t} pulse />
            {archived ? null : (
              <Link
                href={`/student/subjects/${detail.exam.classSubject.id}?locale=${locale}`}
                className="btn btn-inverse btn-sm"
              >
                <Icon.TrendingUp size={14} />
                {t.crossExamWeaknessNav}
              </Link>
            )}
          </div>
        </div>
      </section>

      {archived ? <Alert tone="warn">{t.classArchivedBanner}</Alert> : null}

      {detail.status === "FAILED" && !archived ? (
        <Alert
          tone="error"
          action={
            <button type="button" onClick={() => void retry()} className="btn btn-primary btn-sm">
              <Icon.Refresh size={14} />
              {t.analyzeRetry}
            </button>
          }
        >
          <p>{detail.errorMessage || t.stateError}</p>
          <p className="mt-0.5 text-xs opacity-80">{t.checkFile}</p>
        </Alert>
      ) : null}

      {live ? (
        <div className="card flex items-center gap-3 px-5 py-5 animate-fade-up">
          <Icon.Loader size={20} className="text-[var(--role-student)]" />
          <div>
            <p className="font-semibold text-[var(--ink)]">{t.jobStatusRunning}</p>
            <p className="text-sm text-[var(--muted)]">{t.stateLoading}</p>
          </div>
        </div>
      ) : null}

      {done ? (
        <>
          {detail.questionScores.length > 0 ? (
            <div className="animate-fade-up-delay">
              <ResultSummary summary={summary} t={t} />
            </div>
          ) : null}
          <StudyFocusCard
            locale={locale}
            t={t}
            zh={detail.studyFocusZh}
            en={detail.studyFocusEn}
          />
          <div className="card card-pad animate-fade-up-delay-2">
            <SectionHeader
              icon={<Icon.BookOpen size={18} />}
              title={t.studyReportTitle}
              description={t.studyReportIntro}
              className="mb-4"
              actions={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm no-print"
                  onClick={() => window.print()}
                >
                  <Icon.FileText size={14} />
                  {t.studyPrint}
                </button>
              }
            />
            <p className="mb-3 text-xs text-[var(--muted)]">
              {countLabel(detail.questionScores.length, t.questionsCount, t.questionsCountOne)}
            </p>
            <ExpandableScoreCards
              key={detail.id}
              scores={detail.questionScores}
              t={t}
              locale={locale}
              colorful
              initiallyOpen="all"
            />
          </div>
          <div className="card card-pad animate-fade-up-delay-3">
            <TopicChartStub data={chartData} t={t} intensity="high" />
          </div>
        </>
      ) : null}

      <Link href={`/student?locale=${locale}`} className="link-muted no-print inline-flex items-center gap-1 text-sm">
        <Icon.ArrowLeft size={14} />
        {t.studentNavHome}
      </Link>
    </div>
  );
}
