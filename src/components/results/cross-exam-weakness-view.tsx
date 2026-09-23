"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type RelatedExam = {
  examId: string;
  title: string;
  examDate: string;
  submissionId: string;
};

type WeaknessPayload = {
  classSubject: { id: string; name: string; subjectCode: string };
  student: { id: string; name: string | null; email: string };
  succeededExamCount: number;
  ready: boolean;
  byTopic: Array<{
    topic: string;
    avgScoreRatio: number;
    attemptCount: number;
    examCount: number;
    relatedExams: RelatedExam[];
  }>;
  byItemType: Array<{
    itemType: string;
    avgScoreRatio: number;
    attemptCount: number;
    examCount: number;
  }>;
};

function weaknessHue(ratio: number) {
  // Low ratio → warmer/weaker cue; high → cooler/stronger (student color cues).
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(8 + clamped * 140); // ~8 (weak) → ~148 (stronger teal/green)
}

function pct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

export function CrossExamWeaknessView({
  locale,
  t,
  classSubjectId,
  studentId,
  role,
  uploadHref,
  homeHref,
}: {
  locale: Locale;
  t: Dictionary;
  classSubjectId: string;
  /** Required for teacher; omit for student (self). */
  studentId?: string;
  role: "student" | "teacher";
  uploadHref: string;
  homeHref: string;
}) {
  const [data, setData] = useState<WeaknessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uiState, setUiState] = useState<
    "loading" | "empty" | "error" | "success" | "default"
  >("loading");
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUiState("loading");
    try {
      const qs =
        studentId != null
          ? `?studentId=${encodeURIComponent(studentId)}`
          : "";
      const res = await fetch(
        `/api/class-subjects/${classSubjectId}/weakness${qs}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t.crossExamError);
        setUiState("error");
        return;
      }
      const w = json.weakness as WeaknessPayload;
      setData(w);
      setError(null);
      if (!w.ready) setUiState("empty");
      else setUiState("success");
    } catch {
      setError(t.crossExamError);
      setUiState("error");
    }
  }, [classSubjectId, studentId, t.crossExamError]);

  useEffect(() => {
    void load();
  }, [load]);

  const colorful = role === "student";
  const motionClass = role === "student" ? "animate-fade-up" : "";

  if (uiState === "loading" && !data) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.crossExamLoading}</p>;
  }

  if (uiState === "error") {
    return (
      <div className="mt-8 text-sm text-[var(--color-error)]">
        <p>{error || t.crossExamError}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          {t.settingsRetry}
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{t.stateEmpty}</p>;
  }

  const resultBase =
    role === "student"
      ? `/student/submissions`
      : // Teacher drills into the exam results page with that submission selected.
        null;

  return (
    <div
      className={`mt-8 space-y-8 ${role === "student" ? "student-weakness" : "teacher-weakness"}`}
    >
      <header className={`rounded-2xl px-5 py-6 ${role === "student" ? "student-results-hero" : "border border-[var(--border)] bg-[var(--surface)]"} ${motionClass}`}>
        <p className="text-sm text-[var(--muted)]">
          {data.classSubject.name} · {data.classSubject.subjectCode}
          {role === "teacher" ? (
            <>
              {" "}
              · {data.student.name || data.student.email}
            </>
          ) : null}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
          {t.crossExamWeaknessTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          {t.crossExamWeaknessIntro}
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {t.crossExamExamCount}: {data.succeededExamCount}
        </p>
      </header>

      {uiState === "empty" ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-8 text-sm">
          <p className="font-medium text-[var(--ink)]">{t.crossExamEmpty}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={uploadHref}
              className="rounded-lg bg-[var(--brand)] px-3 py-1.5 font-semibold text-white"
            >
              {t.crossExamEmptyCta}
            </Link>
            <Link href={homeHref} className="text-[var(--muted)] hover:underline">
              {role === "student" ? t.studentNavHome : t.examBack}
            </Link>
          </div>
        </div>
      ) : null}

      {uiState === "success" ? (
        <>
          <p
            className={`text-sm text-[var(--color-success)] ${role === "student" ? "animate-success-pop" : ""}`}
          >
            {t.crossExamReadyNote}
          </p>
          <p className="text-xs text-[var(--muted)]">{t.crossExamDrillHint}</p>

          <section className={role === "student" ? "animate-fade-up-delay" : ""}>
            <h3 className="mb-3 font-semibold">{t.crossExamByTopic}</h3>
            <ul className="space-y-3">
              {data.byTopic.map((row) => {
                const open = openTopic === row.topic;
                const hue = weaknessHue(row.avgScoreRatio);
                return (
                  <li
                    key={row.topic}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                      onClick={() =>
                        setOpenTopic(open ? null : row.topic)
                      }
                      aria-expanded={open}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            colorful ? "topic-chip topic-chip--color" : "topic-chip"
                          }
                          style={
                            colorful
                              ? ({ ["--chip-hue" as string]: hue } as CSSProperties)
                              : undefined
                          }
                        >
                          {t.topicChip}: {row.topic}
                        </span>
                        {colorful ? (
                          <span
                            className="text-xs font-medium"
                            style={{ color: `hsla(${hue}, 70%, 32%, 1)` }}
                          >
                            {row.avgScoreRatio < 0.55
                              ? t.weaknessCueWeak
                              : t.weaknessCueStrong}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm text-[var(--muted)]">
                        {t.crossExamAvgRatio}: {pct(row.avgScoreRatio)} ·{" "}
                        {t.crossExamExamCount}: {row.examCount}
                      </span>
                    </button>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_70%,white)]"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-[var(--motion-base)]"
                        style={{
                          width: pct(row.avgScoreRatio),
                          background: colorful
                            ? `hsla(${hue}, 65%, 45%, 1)`
                            : "var(--brand)",
                          opacity: colorful ? 1 : 0.75,
                        }}
                      />
                    </div>
                    {open ? (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <p className="mb-2 text-xs font-medium text-[var(--muted)]">
                          {t.crossExamRelatedExams}
                        </p>
                        <ul className="space-y-2 text-sm">
                          {row.relatedExams.map((ex) => {
                            const href =
                              role === "student"
                                ? `${resultBase}/${ex.submissionId}?locale=${locale}`
                                : `/teacher/exams/${ex.examId}/results?locale=${locale}&submissionId=${ex.submissionId}`;
                            return (
                              <li key={ex.examId}>
                                <Link
                                  href={href}
                                  className="font-medium text-[var(--brand)] hover:underline"
                                >
                                  {ex.title}
                                </Link>
                                <span className="ml-2 text-[var(--muted)]">
                                  {ex.examDate}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={role === "student" ? "animate-fade-up-delay-2" : ""}>
            <h3 className="mb-3 font-semibold">{t.crossExamByItemType}</h3>
            <ul className="flex flex-wrap gap-3">
              {data.byItemType.map((row, i) => {
                const hue = weaknessHue(row.avgScoreRatio);
                return (
                  <li
                    key={row.itemType}
                    className="min-w-[9rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
                  >
                    <span
                      className={
                        colorful ? "type-chip type-chip--color" : "type-chip"
                      }
                      style={
                        colorful
                          ? ({
                              ["--chip-hue" as string]:
                                150 + i * 40 + Math.round(row.avgScoreRatio * 20),
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      {t.itemTypeChip}: {row.itemType}
                    </span>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {pct(row.avgScoreRatio)}
                    </p>
                    <div
                      className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_70%,white)]"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: pct(row.avgScoreRatio),
                          background: colorful
                            ? `hsla(${hue}, 60%, 42%, 1)`
                            : "var(--color-accent)",
                          opacity: colorful ? 1 : 0.7,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      <Link
        href={homeHref}
        className="inline-block text-sm text-[var(--muted)] hover:underline"
      >
        {role === "student" ? t.studentNavHome : t.examBack}
      </Link>
    </div>
  );
}
