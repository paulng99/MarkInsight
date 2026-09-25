"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { countLabel, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { FileField } from "@/components/ui/file-field";
import { Icon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ClassRoster } from "@/components/teacher/class-roster";

type ExamRow = {
  id: string;
  title: string;
  examDate: string;
  sourceExamId: string | null;
  assetCount: number;
  submissionCount: number;
  latestStructureJob: { id: string; status: string } | null;
};

type ClassGroup = {
  id: string;
  name: string;
  gradeLevel: string | null;
  exams: ExamRow[];
};

type SubjectGroup = {
  subjectCode: string;
  syllabus: {
    originalName: string | null;
    mimeType: string | null;
    updatedAt: string;
  } | null;
  classes: ClassGroup[];
};

const NEW_SUBJECT_VALUE = "__new__";

async function createClassSubject(subjectCode: string, className: string) {
  const res = await fetch("/api/subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectCode, className }),
  });
  const data = (await res.json()) as { error?: string };
  return { ok: res.ok, error: data.error };
}

export function TeacherExamList({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [subjects, setSubjects] = useState<SubjectGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [subjectPick, setSubjectPick] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [className, setClassName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [syllabusReset, setSyllabusReset] = useState(0);
  const [, startTransition] = useTransition();

  const isSuccess = (m: string) =>
    m === t.syllabusUploaded ||
    m === t.addSubjectSuccess ||
    m === t.addClassSuccess ||
    m === t.distributeSuccess;

  const load = useCallback(async () => {
    setError(null);
    try {
      await fetch("/api/workspace");
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.examsError);
        setSubjects([]);
        return;
      }
      const list: SubjectGroup[] = data.subjects ?? [];
      setSubjects(list);
      setSubjectPick((current) => {
        if (list.length === 0) return NEW_SUBJECT_VALUE;
        if (current === NEW_SUBJECT_VALUE) return current;
        if (current && list.some((s) => s.subjectCode === current)) return current;
        return list[0].subjectCode;
      });
    } catch {
      setError(t.examsError);
      setSubjects([]);
    }
  }, [t.examsError]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const list = subjects ?? [];
    let classes = 0;
    let exams = 0;
    let submissions = 0;
    let analysed = 0;
    for (const s of list) {
      classes += s.classes.length;
      for (const c of s.classes) {
        exams += c.exams.length;
        for (const e of c.exams) {
          submissions += e.submissionCount;
          if (e.latestStructureJob?.status === "SUCCEEDED") analysed += 1;
        }
      }
    }
    return { subjects: list.length, classes, exams, submissions, analysed };
  }, [subjects]);

  function onAddSubject(e: React.FormEvent) {
    e.preventDefault();
    const creatingNew = !subjects?.length || subjectPick === NEW_SUBJECT_VALUE;
    const code = creatingNew ? subjectCode : subjectPick;
    setNotice(null);
    setAdding(true);
    startTransition(async () => {
      try {
        const result = await createClassSubject(code, className);
        if (!result.ok) {
          setNotice(result.error || (creatingNew ? t.addSubjectError : t.addClassError));
          return;
        }
        setSubjectCode("");
        setClassName("");
        setSubjectPick(code);
        setNotice(creatingNew ? t.addSubjectSuccess : t.addClassSuccess);
        setShowAdd(false);
        await load();
      } catch {
        setNotice(creatingNew ? t.addSubjectError : t.addClassError);
      } finally {
        setAdding(false);
      }
    });
  }

  function onSyllabus(code: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setNotice(null);
    setPendingCode(code);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/subjects/${encodeURIComponent(code)}/syllabus`,
          { method: "POST", body: fd },
        );
        const data = await res.json();
        if (!res.ok) {
          setNotice(data.error || t.uploadError);
          return;
        }
        setNotice(t.syllabusUploaded);
        form.reset();
        setSyllabusReset((n) => n + 1);
        await load();
      } catch {
        setNotice(t.uploadError);
      } finally {
        setPendingCode(null);
      }
    });
  }

  if (subjects === null) {
    return (
      <div className="mt-8 space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

  const addPanelOpen = showAdd || subjects.length === 0;
  const creatingNewSubject = subjects.length === 0 || subjectPick === NEW_SUBJECT_VALUE;

  return (
    <div className="mt-8 space-y-8">
      <div className="animate-fade-up-delay grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t.statSubjects} value={stats.subjects} icon={<Icon.Layers />} tint="blue" />
        <StatCard label={t.statClasses} value={stats.classes} icon={<Icon.Users />} tint="violet" />
        <StatCard
          label={t.statExams}
          value={stats.exams}
          hint={`${stats.analysed} ${t.statAnalysed.toLowerCase()}`}
          icon={<Icon.FileText />}
          tint="teal"
        />
        <StatCard label={t.statSubmissions} value={stats.submissions} icon={<Icon.Inbox />} tint="amber" />
      </div>

      {notice ? (
        <Alert tone={isSuccess(notice) ? "success" : "error"}>{notice}</Alert>
      ) : null}

      <section className="animate-fade-up-delay-2 space-y-4">
        <SectionHeader
          title={t.examsListTitle}
          description={subjects.length > 0 ? t.addSubjectHint : undefined}
          actions={
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAdd((v) => !v)}
                aria-expanded={addPanelOpen}
              >
                <Icon.Plus size={14} />
                {t.addSubjectTitle}
              </button>
              <Link href={`/teacher/exams/new?locale=${locale}`} className="btn btn-primary btn-sm">
                <Icon.FileText size={14} />
                {t.examCreate}
              </Link>
            </>
          }
        />

        {addPanelOpen ? (
          <form onSubmit={onAddSubject} className="card card-pad animate-fade-up">
            <div className="flex items-start gap-3">
              <span className="icon-tile">
                <Icon.Layers size={18} />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--ink)]">{t.addSubjectTitle}</h3>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{t.addSubjectHint}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div>
                    <label className="label" htmlFor="subject-code">
                      {creatingNewSubject ? t.addSubjectCode : t.addSubjectExisting}
                    </label>
                    {subjects.length > 0 ? (
                      <select
                        id="subject-code"
                        required
                        value={subjectPick}
                        onChange={(e) => setSubjectPick(e.target.value)}
                        className="select"
                      >
                        {subjects.map((subject) => (
                          <option key={subject.subjectCode} value={subject.subjectCode}>
                            {subject.subjectCode}
                            {" · "}
                            {countLabel(
                              subject.classes.length,
                              t.classesCount,
                              t.classesCountOne,
                            )}
                          </option>
                        ))}
                        <option value={NEW_SUBJECT_VALUE}>{t.addSubjectNewOption}</option>
                      </select>
                    ) : null}
                    {creatingNewSubject ? (
                      <>
                        {subjects.length > 0 ? (
                          <label className="label mt-3" htmlFor="subject-code-new">
                            {t.addSubjectCode}
                          </label>
                        ) : null}
                        <input
                          id={subjects.length > 0 ? "subject-code-new" : "subject-code"}
                          required
                          value={subjectCode}
                          onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                          placeholder={t.addSubjectNewPlaceholder}
                          className="input uppercase"
                          autoComplete="off"
                        />
                      </>
                    ) : null}
                  </div>
                  <div>
                    <label className="label" htmlFor="class-name">
                      {t.addSubjectClass}
                    </label>
                    <input
                      id="class-name"
                      required
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="3A"
                      className="input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={adding} className="btn btn-primary">
                      {adding ? <Icon.Loader size={16} /> : <Icon.Plus size={16} />}
                      {adding
                        ? creatingNewSubject
                          ? t.addSubjectSaving
                          : t.addClassSaving
                        : creatingNewSubject
                          ? t.addSubjectSubmit
                          : t.addClassSubmit}
                    </button>
                    {subjects.length > 0 ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowAdd(false)}
                      >
                        {t.cancel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : null}

        {subjects.length === 0 ? (
          <EmptyState
            icon={<Icon.Inbox size={22} />}
            title={t.subjectsEmpty}
            description={t.addSubjectHint}
          />
        ) : (
          <div className="space-y-6">
            {subjects.map((subject, i) => (
              <SubjectCard
                key={subject.subjectCode}
                subject={subject}
                index={i}
                locale={locale}
                t={t}
                pending={pendingCode === subject.subjectCode}
                syllabusReset={syllabusReset}
                onSyllabus={(e) => onSyllabus(subject.subjectCode, e)}
                onNotice={(m) => {
                  setNotice(m);
                  if (isSuccess(m)) void load();
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const subjectHues = [222, 262, 172, 28, 345, 200];

function SubjectCard({
  subject,
  index,
  locale,
  t,
  pending,
  syllabusReset,
  onSyllabus,
  onNotice,
}: {
  subject: SubjectGroup;
  index: number;
  locale: Locale;
  t: Dictionary;
  pending: boolean;
  syllabusReset: number;
  onSyllabus: (e: React.FormEvent<HTMLFormElement>) => void;
  onNotice: (message: string) => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const hue = subjectHues[index % subjectHues.length];
  const examCount = subject.classes.reduce((n, c) => n + c.exams.length, 0);

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="display flex h-11 w-11 items-center justify-center rounded-xl text-sm"
            style={{
              background: `hsl(${hue} 80% 94%)`,
              color: `hsl(${hue} 60% 32%)`,
            }}
          >
            {subject.subjectCode.slice(0, 3)}
          </span>
          <div>
            <p className="eyebrow">{t.subjectGroup}</p>
            <h3 className="text-lg font-bold text-[var(--ink)]">{subject.subjectCode}</h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span className="badge badge-neutral">
            {countLabel(subject.classes.length, t.classesCount, t.classesCountOne)}
          </span>
          <span className="badge badge-neutral">
            {countLabel(examCount, t.examsCount, t.examsCountOne)}
          </span>
          <span className={`badge badge-dot ${subject.syllabus ? "badge-success" : "badge-warn"}`}>
            {subject.syllabus ? t.syllabusTitle : t.syllabusEmpty}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAddClassOpen((v) => !v)}
            aria-expanded={addClassOpen}
          >
            <Icon.Plus size={14} />
            {t.addClassTitle}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
          >
            <Icon.Settings size={14} />
            {toolsOpen ? t.hideTools : t.showTools}
            <Icon.ChevronDown
              size={14}
              className={`transition-transform ${toolsOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </header>

      {toolsOpen ? (
        <div className="animate-fade-up grid gap-4 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 sm:px-6 lg:grid-cols-2">
          <form onSubmit={onSyllabus} className="card card-pad space-y-3">
            <div className="flex items-start gap-3">
              <span className="icon-tile">
                <Icon.BookOpen size={18} />
              </span>
              <div>
                <p className="font-semibold text-[var(--ink)]">{t.syllabusTitle}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t.syllabusHint}</p>
              </div>
            </div>
            {subject.syllabus ? (
              <p className="flex items-center gap-2 rounded-lg bg-[var(--color-success-soft)] px-3 py-2 text-xs text-[var(--color-success)]">
                <Icon.CheckCircle size={14} />
                <span className="truncate font-medium">
                  {subject.syllabus.originalName || t.syllabusTitle}
                </span>
                <span className="ml-auto shrink-0 opacity-80">{subject.syllabus.updatedAt}</span>
              </p>
            ) : null}
            <FileField
              required
              compact
              accept="application/pdf,image/*,text/plain"
              title={t.dropzoneTitle}
              hint={t.dropzoneHint}
              selectedLabel={t.fileSelected}
              resetKey={syllabusReset}
            />
            <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
              {pending ? <Icon.Loader size={14} /> : <Icon.Upload size={14} />}
              {pending ? t.syllabusUploading : subject.syllabus ? t.syllabusReplace : t.syllabusUpload}
            </button>
          </form>

          <DistributeExam subject={subject} t={t} onDone={onNotice} onError={onNotice} />
        </div>
      ) : null}

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {addClassOpen ? (
          <AddClassForm
            subjectCode={subject.subjectCode}
            t={t}
            onCancel={() => setAddClassOpen(false)}
            onDone={(message) => {
              setAddClassOpen(false);
              onNotice(message);
            }}
          />
        ) : null}
        {subject.classes.map((cls) => (
          <div key={cls.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Icon.Users size={15} className="text-[var(--muted)]" />
                {t.classGroup} {cls.name}
                <span className="text-xs font-medium text-[var(--muted)]">
                  · {countLabel(cls.exams.length, t.examsCount, t.examsCountOne)}
                </span>
              </h4>
              <Link
                href={`/teacher/exams/new?locale=${locale}&classSubjectId=${cls.id}`}
                className="link text-sm"
              >
                <span className="inline-flex items-center gap-1">
                  <Icon.Plus size={14} />
                  {t.examCreate}
                </span>
              </Link>
            </div>
            <ClassRoster classSubjectId={cls.id} className={cls.name} t={t} />
            {cls.exams.length === 0 ? (
              <EmptyState compact title={t.examsEmpty} />
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {cls.exams.map((exam) => (
                  <li key={exam.id}>
                    <Link
                      href={`/teacher/exams/${exam.id}?locale=${locale}`}
                      className="row-link group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--ink)]">{exam.title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                            <span className="inline-flex items-center gap-1">
                              <Icon.Calendar size={12} />
                              {exam.examDate}
                            </span>
                            {exam.sourceExamId ? (
                              <span className="badge badge-violet">{t.distributeCopy}</span>
                            ) : null}
                          </p>
                        </div>
                        {exam.latestStructureJob ? (
                          <JobStatusBadge status={exam.latestStructureJob.status} t={t} />
                        ) : (
                          <span className="badge badge-neutral">{t.notStarted}</span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
                        <span className="flex gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Icon.FileText size={12} />
                            {countLabel(exam.assetCount, t.assetsLabel, t.assetsLabelOne)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icon.Inbox size={12} />
                            {countLabel(exam.submissionCount, t.submissionsLabel, t.submissionsLabelOne)}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
                          {t.openExamAction}
                          <Icon.ArrowRight size={12} />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {!addClassOpen ? (
          <button
            type="button"
            className="card-muted flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
            onClick={() => setAddClassOpen(true)}
          >
            <Icon.Plus size={15} />
            {t.addClassTitle}
            <span className="font-medium text-[var(--muted)]">· {subject.subjectCode}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function AddClassForm({
  subjectCode,
  t,
  onCancel,
  onDone,
}: {
  subjectCode: string;
  t: Dictionary;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [className, setClassName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    startTransition(async () => {
      try {
        const result = await createClassSubject(subjectCode, className);
        if (!result.ok) {
          setError(result.error || t.addClassError);
          return;
        }
        setClassName("");
        onDone(t.addClassSuccess);
      } catch {
        setError(t.addClassError);
      } finally {
        setAdding(false);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-4 animate-fade-up"
    >
      <div className="flex items-start gap-3">
        <span className="icon-tile !h-9 !w-9">
          <Icon.Users size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--ink)]">{t.addClassTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t.addClassHint}{" "}
            <span className="font-semibold text-primary-700">{subjectCode}</span>
          </p>
          {error ? <Alert tone="error" className="mt-3">{error}</Alert> : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor={`add-class-${subjectCode}`}>
                {t.addSubjectClass}
              </label>
              <input
                id={`add-class-${subjectCode}`}
                required
                autoFocus
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="3A"
                className="input"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={adding} className="btn btn-primary">
                {adding ? <Icon.Loader size={16} /> : <Icon.Plus size={16} />}
                {adding ? t.addClassSaving : t.addClassSubmit}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onCancel}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function DistributeExam({
  subject,
  t,
  onDone,
  onError,
}: {
  subject: SubjectGroup;
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const originals = subject.classes.flatMap((cls) =>
    cls.exams
      .filter((exam) => !exam.sourceExamId)
      .map((exam) => ({ ...exam, classId: cls.id, className: cls.name })),
  );
  const [examId, setExamId] = useState(originals[0]?.id ?? "");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const selected = originals.find((exam) => exam.id === examId) ?? originals[0];
  const heldClassIds = new Set<string>();
  if (selected) {
    heldClassIds.add(selected.classId);
    for (const cls of subject.classes) {
      if (cls.exams.some((exam) => exam.sourceExamId === selected.id)) {
        heldClassIds.add(cls.id);
      }
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setPending(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/exams/${encodeURIComponent(selected.id)}/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classSubjectIds: classIds }),
        });
        const data = await res.json();
        if (!res.ok) {
          onError(data.error || t.distributeError);
          return;
        }
        setClassIds([]);
        onDone(t.distributeSuccess);
      } catch {
        onError(t.distributeError);
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad space-y-3">
      <div className="flex items-start gap-3">
        <span className="icon-tile" style={{ ["--tile-bg" as string]: "#efeafd", ["--tile-fg" as string]: "var(--violet-600)" }}>
          <Icon.Share size={18} />
        </span>
        <div>
          <p className="font-semibold text-[var(--ink)]">{t.distributeTitle}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t.distributeHint}</p>
        </div>
      </div>
      {originals.length === 0 ? (
        <p className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--muted)]">
          {t.distributeEmpty}
        </p>
      ) : (
        <>
          <div>
            <label className="label">{t.distributeExam}</label>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                setExamId(e.target.value);
                setClassIds([]);
              }}
              className="select"
            >
              {originals.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} · {exam.className} · {exam.examDate}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="label">{t.distributeClasses}</legend>
            <div className="flex flex-wrap gap-2">
              {subject.classes.map((cls) => {
                const held = heldClassIds.has(cls.id);
                const checked = held || classIds.includes(cls.id);
                return (
                  <label
                    key={cls.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      checked
                        ? "border-primary-300 bg-primary-50 text-primary-800"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    } ${held ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={checked}
                      disabled={held || pending}
                      onChange={(e) => {
                        setClassIds((current) =>
                          e.target.checked
                            ? [...current, cls.id]
                            : current.filter((id) => id !== cls.id),
                        );
                      }}
                    />
                    <span>
                      {cls.name}
                      {held ? ` · ${t.distributeAlready}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={pending || classIds.length === 0}
            className="btn btn-secondary btn-sm"
          >
            {pending ? <Icon.Loader size={14} /> : <Icon.Send size={14} />}
            {pending ? t.distributeSaving : t.distributeSubmit}
          </button>
        </>
      )}
    </form>
  );
}
