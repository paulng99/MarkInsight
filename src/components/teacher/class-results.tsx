"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { ExpandableScoreCards } from "@/components/results/expandable-score-cards";
import { TopicChartStub } from "@/components/results/topic-chart-stub";

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
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<string | null>(
    initialSubmissionId ?? null,
  );
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}/submissions`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || t.stateError);
      return;
    }
    setStudents(data.students ?? []);
    if (!selected) {
      const first = (data.students as StudentRow[]).find((s) => s.submission);
      if (first?.submission) setSelected(first.submission.id);
    }
  }, [examId, selected, t.stateError]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/submissions/${selected}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.stateError);
        return;
      }
      setDetail(data.submission);
      setError(null);
    })();
  }, [selected, t.stateError]);

  const chartData =
    detail?.aggregates.map((a) => ({
      topic: `${a.topic}/${a.itemType}`,
      ratio: a.avgScoreRatio,
    })) ??
    detail?.questionScores.reduce<Array<{ topic: string; ratio: number }>>(
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
    ) ??
    [];

  return (
    <div className="mt-8 space-y-6 teacher-results">
      {error ? (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {students.map((s) =>
          s.submission ? (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelected(s.submission!.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                selected === s.submission.id
                  ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,white)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <span className="mr-2">{s.name || s.email}</span>
              <JobStatusBadge status={s.submission.status} t={t} />
            </button>
          ) : (
            <span
              key={s.studentId}
              className="rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]"
            >
              {s.name || s.email}
            </span>
          ),
        )}
      </div>

      {!detail ? (
        <p className="text-sm text-[var(--muted)]">{t.stateEmpty}</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <JobStatusBadge status={detail.status} t={t} pulse />
            {detail.scoringLlmModel ? (
              <span className="text-xs text-[var(--muted)]">
                {t.scoringModelStored}
              </span>
            ) : null}
          </div>
          {detail.status === "FAILED" ? (
            <p className="text-sm text-[var(--color-error)]">
              {detail.errorMessage || t.stateError} — {t.checkFile}
            </p>
          ) : null}
          <TopicChartStub data={chartData} t={t} intensity="medium" />
          {detail.exam?.classSubject?.id ? (
            <Link
              href={`/teacher/class-subjects/${detail.exam.classSubject.id}/students/${detail.student.id}/weakness?locale=${locale}&fromExamId=${examId}`}
              className="inline-block text-sm font-medium text-[var(--brand)] hover:underline"
            >
              {t.teacherStudentWeakness}
            </Link>
          ) : null}
          <div>
            <h3 className="mb-3 font-semibold">{t.expandScores}</h3>
            <ExpandableScoreCards
              scores={detail.questionScores}
              t={t}
              colorful={false}
            />
          </div>
        </div>
      )}

      <Link
        href={`/teacher/exams/${examId}?locale=${locale}`}
        className="inline-block text-sm text-[var(--muted)] hover:underline"
      >
        {t.examBack}
      </Link>
    </div>
  );
}
