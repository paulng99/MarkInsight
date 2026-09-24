"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

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

/** Low ratio → warm (rose); high → cool (teal/green). */
function weaknessHue(ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(8 + clamped * 150);
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
  const [uiState, setUiState] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUiState("loading");
    try {
      const qs = studentId != null ? `?studentId=${encodeURIComponent(studentId)}` : "";
      const res = await fetch(`/api/class-subjects/${classSubjectId}/weakness${qs}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t.crossExamError);
        setUiState("error");
        return;
      }
      const w = json.weakness as WeaknessPayload;
      setData(w);
      setError(null);
      setUiState(w.ready ? "success" : "empty");
    } catch {
      setError(t.crossExamError);
      setUiState("error");
    }
  }, [classSubjectId, studentId, t.crossExamError]);

  useEffect(() => {
    void load();
  }, [load]);

  const colorful = role === "student";
  const heroClass = role === "student" ? "role-hero role-hero--student" : "role-hero role-hero--teacher";

  if (uiState === "loading" && !data) {
    return (
      <div className="mt-8 space-y-6">
        <div className="skeleton h-28" />
        <LoadingBlock label={t.crossExamLoading} />
      </div>
    );
  }

  if (uiState === "error") {
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
        {error || t.crossExamError}
      </Alert>
    );
  }

  if (!data) {
    return <EmptyState className="mt-8" title={t.stateEmpty} />;
  }

  const weakest = [...data.byTopic].sort((a, b) => a.avgScoreRatio - b.avgScoreRatio)[0];
  const strongest = [...data.byTopic].sort((a, b) => b.avgScoreRatio - a.avgScoreRatio)[0];

  return (
    <div className={`mt-8 space-y-6 ${role === "student" ? "student-weakness" : "teacher-weakness"}`}>
      <section className={`${heroClass} animate-fade-up px-6 py-6 sm:px-8`}>
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
              {data.classSubject.name} · {data.classSubject.subjectCode}
            </p>
            <h2 className="display mt-1.5 text-2xl">
              {role === "teacher" ? data.student.name || data.student.email : t.crossExamWeaknessTitle}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/85">{t.crossExamWeaknessIntro}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-3 text-center backdrop-blur">
            <p className="display text-3xl tabular-nums">{data.succeededExamCount}</p>
            <p className="text-xs font-semibold text-white/85">{t.crossExamExamCount}</p>
          </div>
        </div>
      </section>

      {uiState === "empty" ? (
        <EmptyState
          icon={<Icon.Clock size={22} />}
          title={t.crossExamEmpty}
          description={t.crossExamWeaknessIntro}
          action={
            <>
              <Link href={uploadHref} className="btn btn-primary btn-sm">
                <Icon.Upload size={14} />
                {t.crossExamEmptyCta}
              </Link>
              <Link href={homeHref} className="btn btn-ghost btn-sm">
                {role === "student" ? t.studentNavHome : t.examBack}
              </Link>
            </>
          }
        />
      ) : null}

      {uiState === "success" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3 animate-fade-up-delay">
            <StatCard
              label={t.crossExamExamCount}
              value={data.succeededExamCount}
              icon={<Icon.FileText />}
              tint={role === "student" ? "teal" : "blue"}
            />
            <StatCard
              label={t.strongestTopic}
              value={strongest ? pct(strongest.avgScoreRatio) : "—"}
              hint={strongest?.topic}
              icon={<Icon.TrendingUp />}
              tint="emerald"
            />
            <StatCard
              label={t.weakestTopic}
              value={weakest ? pct(weakest.avgScoreRatio) : "—"}
              hint={weakest?.topic}
              icon={<Icon.Target />}
              tint="rose"
            />
          </div>

          <Alert tone="success">{t.crossExamReadyNote}</Alert>

          <section className="card card-pad animate-fade-up-delay-2">
            <SectionHeader
              icon={<Icon.Layers size={18} />}
              title={t.crossExamByTopic}
              description={t.crossExamDrillHint}
              className="mb-4"
            />
            <ul className="space-y-2">
              {data.byTopic.map((row) => {
                const open = openTopic === row.topic;
                const hue = weaknessHue(row.avgScoreRatio);
                const weak = row.avgScoreRatio < 0.55;
                return (
                  <li
                    key={row.topic}
                    className={`rounded-xl border bg-[var(--surface)] px-4 py-3 transition-[box-shadow,border-color] ${
                      open ? "border-[var(--border-strong)] shadow-[var(--shadow-sm)]" : "border-[var(--border)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                      onClick={() => setOpenTopic(open ? null : row.topic)}
                      aria-expanded={open}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={colorful ? "topic-chip topic-chip--color" : "topic-chip"}
                          style={colorful ? ({ ["--chip-hue" as string]: hue } as CSSProperties) : undefined}
                        >
                          {row.topic}
                        </span>
                        <span
                          className={`badge ${
                            colorful
                              ? weak
                                ? "badge-error"
                                : "badge-success"
                              : "badge-neutral"
                          }`}
                        >
                          {weak ? t.weaknessCueWeak : t.weaknessCueStrong}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 text-sm text-[var(--muted)]">
                        <span className="font-bold tabular-nums text-[var(--ink)]">{pct(row.avgScoreRatio)}</span>
                        <span className="hidden sm:inline">
                          {t.crossExamExamCount}: {row.examCount} · {t.crossExamAttemptCount}: {row.attemptCount}
                        </span>
                        <Icon.ChevronDown
                          size={16}
                          className={`transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                    <div className="progress mt-2 !h-2" aria-hidden>
                      <span
                        style={{
                          width: pct(row.avgScoreRatio),
                          background: colorful ? `hsl(${hue} 65% 45%)` : "var(--color-primary)",
                          opacity: colorful ? 1 : 0.8,
                        }}
                      />
                    </div>
                    {open ? (
                      <div className="mt-3 border-t border-[var(--border)] pt-3 animate-fade-up">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                          {t.crossExamRelatedExams}
                        </p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {row.relatedExams.map((ex) => {
                            const href =
                              role === "student"
                                ? `/student/submissions/${ex.submissionId}?locale=${locale}`
                                : `/teacher/exams/${ex.examId}/results?locale=${locale}&submissionId=${ex.submissionId}`;
                            return (
                              <li key={ex.examId}>
                                <Link href={href} className="row-link flex items-center justify-between gap-2 !py-2.5 text-sm">
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold text-[var(--ink)]">{ex.title}</span>
                                    <span className="text-xs text-[var(--muted)]">{ex.examDate}</span>
                                  </span>
                                  <Icon.ArrowRight size={14} className="shrink-0 text-primary-600" />
                                </Link>
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

          <section className="card card-pad animate-fade-up-delay-3">
            <SectionHeader icon={<Icon.Target size={18} />} title={t.crossExamByItemType} className="mb-4" />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.byItemType.map((row, i) => {
                const hue = colorful ? 160 + i * 40 : 222;
                return (
                  <li key={row.itemType} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={colorful ? "type-chip type-chip--color" : "type-chip"}
                        style={colorful ? ({ ["--chip-hue" as string]: hue } as CSSProperties) : undefined}
                      >
                        {row.itemType}
                      </span>
                      <span className="display text-lg tabular-nums text-[var(--ink)]">{pct(row.avgScoreRatio)}</span>
                    </div>
                    <div className="progress mt-3 !h-1.5" aria-hidden>
                      <span
                        style={{
                          width: pct(row.avgScoreRatio),
                          background: colorful ? `hsl(${weaknessHue(row.avgScoreRatio)} 60% 45%)` : "var(--color-accent)",
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {t.crossExamExamCount}: {row.examCount} · {t.crossExamAttemptCount}: {row.attemptCount}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      <Link href={homeHref} className="link-muted inline-flex items-center gap-1 text-sm">
        <Icon.ArrowLeft size={14} />
        {role === "student" ? t.studentNavHome : t.examBack}
      </Link>
    </div>
  );
}
