"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { ExpandableScoreCards } from "@/components/results/expandable-score-cards";
import { TopicChartStub } from "@/components/results/topic-chart-stub";

type SubmissionDetail = {
  id: string;
  status: string;
  errorMessage: string | null;
  scoringLlmModel: string | null;
  exam: {
    id: string;
    title: string;
    examDate: string;
    classSubject: { name: string };
  };
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
  jobs: Array<{ id: string; status: string; errorMessage: string | null }>;
};

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
  const [uiState, setUiState] = useState<
    "loading" | "empty" | "error" | "success" | "default"
  >("loading");

  const load = useCallback(async () => {
    setUiState("loading");
    try {
      const res = await fetch(`/api/submissions/${submissionId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.stateError);
        setUiState("error");
        return;
      }
      setDetail(data.submission);
      setError(null);
      const status = data.submission.status as string;
      if (status === "DONE") setUiState("success");
      else if (status === "FAILED") setUiState("error");
      else if (status === "PENDING" || status === "QUEUED" || status === "ANALYZING")
        setUiState("default");
      else setUiState("empty");
    } catch {
      setError(t.stateError);
      setUiState("error");
    }
  }, [submissionId, t.stateError]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 2000);
    return () => window.clearInterval(id);
  }, [load]);

  async function retry() {
    const res = await fetch(`/api/submissions/${submissionId}/analyze`, {
      method: "POST",
    });
    if (res.ok) await load();
  }

  if (uiState === "loading" && !detail) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.stateLoading}</p>;
  }

  if (uiState === "error" && !detail) {
    return (
      <div className="mt-8 text-sm text-[var(--color-error)]">
        <p>{error || t.stateError}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          {t.settingsRetry}
        </button>
      </div>
    );
  }

  if (!detail) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.stateEmpty}</p>;
  }

  const chartData =
    detail.aggregates.length > 0
      ? detail.aggregates.map((a) => ({
          topic: a.topic,
          ratio: a.avgScoreRatio,
        }))
      : detail.questionScores.reduce<Array<{ topic: string; ratio: number }>>(
          (acc, q) => {
            const existing = acc.find((x) => x.topic === q.topic);
            const ratio = q.maxScore > 0 ? q.score / q.maxScore : 0;
            if (existing) existing.ratio = (existing.ratio + ratio) / 2;
            else acc.push({ topic: q.topic, ratio });
            return acc;
          },
          [],
        );

  return (
    <div className="mt-8 space-y-8 student-results">
      <div className="student-results-hero rounded-2xl px-5 py-6">
        <p className="text-sm text-[var(--muted)]">
          {detail.exam.classSubject.name} · {detail.exam.examDate}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
          {detail.exam.title}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <JobStatusBadge status={detail.status} t={t} pulse />
          {detail.scoringLlmModel ? (
            <span className="text-xs text-[var(--muted)]">
              {t.scoringModelStored}
            </span>
          ) : null}
        </div>
      </div>

      {detail.status === "FAILED" ? (
        <div className="rounded-xl border border-[var(--color-error)]/30 bg-[color-mix(in_srgb,var(--color-error)_8%,white)] px-4 py-4 text-sm text-[var(--color-error)]">
          <p>{detail.errorMessage || t.stateError}</p>
          <p className="mt-1 text-[var(--muted)]">{t.checkFile}</p>
          <button
            type="button"
            onClick={() => void retry()}
            className="mt-3 rounded-lg bg-[var(--brand)] px-3 py-1.5 font-semibold text-white"
          >
            {t.analyzeRetry}
          </button>
        </div>
      ) : null}

      {detail.status === "QUEUED" ||
      detail.status === "PENDING" ||
      detail.status === "ANALYZING" ? (
        <p className="text-sm text-[var(--muted)] animate-fade-up">{t.stateLoading}</p>
      ) : null}

      {detail.status === "DONE" ? (
        <>
          <TopicChartStub data={chartData} t={t} intensity="high" />
          <div>
            <h3 className="mb-3 font-semibold animate-fade-up-delay">
              {t.expandScores}
            </h3>
            <div className="animate-fade-up-delay-2">
              <ExpandableScoreCards scores={detail.questionScores} t={t} colorful />
            </div>
          </div>
        </>
      ) : null}

      <Link
        href={`/student?locale=${locale}`}
        className="inline-block text-sm text-[var(--muted)] hover:underline"
      >
        {t.studentNavHome}
      </Link>
    </div>
  );
}
