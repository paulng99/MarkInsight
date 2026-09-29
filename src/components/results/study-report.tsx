import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icons";

export function localeText(locale: Locale, zh?: string | null, en?: string | null): string {
  const primary = locale === "en" ? en : zh;
  const secondary = locale === "en" ? zh : en;
  return (primary?.trim() || secondary?.trim() || "").trim();
}

function linesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function StudyBlock({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "good" | "weak" | "watch" | "next";
}) {
  const lines = linesOf(body);
  if (lines.length === 0) return null;
  return (
    <section className={`study-block study-block--${tone}`}>
      <h4 className="study-block-title">{title}</h4>
      {lines.length > 1 ? (
        <ol className="study-block-list">
          {lines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      ) : (
        <p className="leading-relaxed">{lines[0]}</p>
      )}
    </section>
  );
}

export function StudyFocusCard({
  locale,
  t,
  zh,
  en,
}: {
  locale: Locale;
  t: Dictionary;
  zh?: string | null;
  en?: string | null;
}) {
  const body = localeText(locale, zh, en);
  const lines = linesOf(body);
  if (lines.length === 0) return null;
  return (
    <section className="study-focus">
      <div className="flex items-start gap-3">
        <span className="icon-tile" style={{ ["--tile-bg" as string]: "#dbe6ff", ["--tile-fg" as string]: "var(--blue-700, #1d4ed8)" }}>
          <Icon.Target size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--ink)]">{t.studyFocusTitle}</h3>
          {lines.length > 1 ? (
            <ol className="study-block-list mt-2 text-sm text-[var(--ink)]">
              {lines.map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">{lines[0]}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function QuestionStudyReport({
  locale,
  t,
  feedback,
  didWellZh,
  didWellEn,
  weaknessZh,
  weaknessEn,
  mistakesToWatchZh,
  mistakesToWatchEn,
  howToImproveZh,
  howToImproveEn,
}: {
  locale: Locale;
  t: Dictionary;
  feedback?: string | null;
  didWellZh?: string | null;
  didWellEn?: string | null;
  weaknessZh?: string | null;
  weaknessEn?: string | null;
  mistakesToWatchZh?: string | null;
  mistakesToWatchEn?: string | null;
  howToImproveZh?: string | null;
  howToImproveEn?: string | null;
}) {
  const didWell = localeText(locale, didWellZh, didWellEn);
  const weakness = localeText(locale, weaknessZh, weaknessEn);
  const mistakes = localeText(locale, mistakesToWatchZh, mistakesToWatchEn);
  const improve = localeText(locale, howToImproveZh, howToImproveEn);
  const hasStudy = Boolean(didWell || weakness || mistakes || improve);
  const overview = feedback?.trim() ?? "";
  const overviewMatchesLocale = overview
    ? locale === "en"
      ? !/[\u4e00-\u9fff]/.test(overview)
      : /[\u4e00-\u9fff]/.test(overview)
    : false;

  if (!hasStudy) {
    return overview ? (
      <p className="leading-relaxed text-[var(--ink)]">{overview}</p>
    ) : (
      <p className="text-[var(--muted)]">{t.noScoresYet}</p>
    );
  }

  return (
    <div className="space-y-3">
      {overviewMatchesLocale ? (
        <p className="text-sm leading-relaxed text-[var(--ink-secondary,var(--muted))]">
          <span className="font-semibold text-[var(--ink)]">{t.studyOverview}. </span>
          {overview}
        </p>
      ) : null}
      <div className="grid gap-2">
        <StudyBlock title={t.studyDidWell} body={didWell} tone="good" />
        <StudyBlock title={t.studyWeakness} body={weakness} tone="weak" />
        <StudyBlock title={t.studyMistakes} body={mistakes} tone="watch" />
        <StudyBlock title={t.studyImprove} body={improve} tone="next" />
      </div>
    </div>
  );
}
