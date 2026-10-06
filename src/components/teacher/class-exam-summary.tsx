"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/page-header";

type QuestionRow = {
  questionKey: string;
  topic: string;
  avgScoreRatio: number;
  attemptCount: number;
};

type TopicRow = {
  topic: string;
  avgScoreRatio: number;
  attemptCount: number;
};

type SummaryPayload = {
  exam: { id: string; title: string };
  classSubject: { id: string; name: string };
  uploadedCount: number;
  enrolledCount: number;
  questions: QuestionRow[];
  topics: TopicRow[];
  weakestThree: QuestionRow[];
};

function pct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

function TopicLabel({ topic, t }: { topic: string; t: Dictionary }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{topic}</span>
      <span className="badge badge-neutral text-[0.65rem]">{t.aiTopicTag}</span>
    </span>
  );
}

export function TeacherClassExamSummary({
  locale,
  t,
  examId,
}: {
  locale: Locale;
  t: Dictionary;
  examId: string;
}) {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/summary`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t.classExamSummaryError);
        setData(null);
        return;
      }
      setData(json.summary as SummaryPayload);
      setError(null);
    } catch {
      setError(t.classExamSummaryError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [examId, t.classExamSummaryError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <LoadingBlock label={t.classExamSummaryLoading} className="mt-8" />;
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

  if (!data) {
    return <EmptyState className="mt-8" title={t.stateEmpty} />;
  }

  const { uploadedCount, enrolledCount } = data;
  const sortedQuestions = [...data.questions].sort((a, b) => {
    const diff = a.avgScoreRatio - b.avgScoreRatio;
    if (diff !== 0) return sortAsc ? diff : -diff;
    return a.questionKey.localeCompare(b.questionKey);
  });

  return (
    <div className="mt-8 space-y-6">
      <div className="card card-pad animate-fade-up">
        <p className="eyebrow">{t.classExamSummaryUploadCount}</p>
        <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
          {t.classExamSummaryUploaded
            .replace("{x}", String(uploadedCount))
            .replace("{y}", String(enrolledCount))}
        </p>
        {uploadedCount > 0 && uploadedCount < enrolledCount ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t.classExamSummaryPartialNote}
          </p>
        ) : null}
      </div>

      {uploadedCount === 0 ? (
        <EmptyState
          icon={<Icon.FileText size={22} />}
          title={t.classExamSummaryEmpty}
          description={t.classExamSummaryEmptyHint}
        />
      ) : (
        <>
          <section className="card card-pad animate-fade-up-delay">
            <SectionHeader
              icon={<Icon.TrendingUp size={18} />}
              title={t.classExamSummaryWeakestThree}
              description={t.classExamSummaryWeakestIntro}
              className="mb-4"
            />
            <ol className="space-y-3">
              {data.weakestThree.map((q, index) => (
                <li
                  key={q.questionKey}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--ink)]">
                      <span className="mr-2 text-[var(--muted)]">{index + 1}.</span>
                      {q.questionKey}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      <TopicLabel topic={q.topic} t={t} />
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[var(--color-primary)]">
                    {pct(q.avgScoreRatio)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="card card-pad animate-fade-up-delay-2">
            <SectionHeader
              title={t.classExamSummaryAllQuestions}
              description={t.classExamSummaryAllQuestionsIntro}
              className="mb-4"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-2 pr-3 font-medium">{t.classExamSummaryQuestionKey}</th>
                    <th className="py-2 pr-3 font-medium">{t.topicChip}</th>
                    <th className="py-2 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-[var(--ink)]"
                        onClick={() => setSortAsc((v) => !v)}
                      >
                        {t.classExamSummaryClassAvg}
                        <span aria-hidden>{sortAsc ? "↑" : "↓"}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQuestions.map((q) => (
                    <tr key={q.questionKey} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                        {q.questionKey}
                      </td>
                      <td className="py-2.5 pr-3">
                        <TopicLabel topic={q.topic} t={t} />
                      </td>
                      <td className="py-2.5 font-semibold">{pct(q.avgScoreRatio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card card-pad">
            <SectionHeader
              title={t.classExamSummaryByTopic}
              description={t.classExamSummaryByTopicIntro}
              className="mb-4"
            />
            <ul className="space-y-2">
              {data.topics.map((row) => (
                <li
                  key={row.topic}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <TopicLabel topic={row.topic} t={t} />
                  <span className="font-semibold text-[var(--ink)]">
                    {pct(row.avgScoreRatio)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Link
        href={`/teacher/exams/${examId}/results?locale=${locale}`}
        className="link-muted no-print inline-flex items-center gap-1 text-sm"
      >
        <Icon.ArrowLeft size={14} />
        {t.classResults}
      </Link>
    </div>
  );
}
