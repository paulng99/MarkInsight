"use client";

import { useState } from "react";
import { AdminDeleteDialog } from "@/components/admin/admin-delete-dialog";
import { Icon } from "@/components/ui/icons";
import {
  fillDeleteImpactTemplate,
} from "@/lib/admin/delete-confirm";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function messageForArchiveCode(
  code: string | undefined,
  fallback: string | undefined,
  t: Dictionary,
): string {
  switch (code) {
    case "subject_archived":
      return t.errorSubjectArchived;
    case "class_name_archived":
      return t.errorClassNameArchived;
    case "class_archived":
      return t.classArchivedBanner;
    case "delete_rejected":
      return t.adminSubjectsDeleteRejected;
    default:
      return fallback || t.archiveActionError;
  }
}

function ConfirmDialog({
  titleId,
  title,
  body,
  confirmLabel,
  pending,
  danger,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  titleId: string;
  title: string;
  body: string;
  confirmLabel: string;
  pending: boolean;
  danger?: boolean;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="card w-full max-w-md p-6">
        <h2 id={titleId} className="text-lg font-semibold text-[var(--ink)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function teacherDeleteImpact(
  t: Dictionary,
  counts: { examCount: number; submissionCount: number },
): string {
  const submissions = fillDeleteImpactTemplate(t.deleteImpactSubmissions, {
    submissions: counts.submissionCount,
  });
  const exams = fillDeleteImpactTemplate(t.deleteImpactExams, {
    exams: counts.examCount,
  });
  return `${submissions}\n${exams}`;
}

async function sendArchive(
  url: string,
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { error?: string; code?: string };
  if (!res.ok) {
    const error = new Error(data.error || "archive") as Error & { code?: string };
    error.code = data.code;
    throw error;
  }
}

function useConfirmAction(onDone: (message: string) => void, onError: (message: string) => void) {
  const [pending, setPending] = useState(false);

  async function run(
    url: string,
    method: "POST" | "DELETE",
    success: string,
    t: Dictionary,
    body?: Record<string, unknown>,
  ) {
    setPending(true);
    try {
      await sendArchive(url, method, body);
      onDone(success);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      const fallback = error instanceof Error ? error.message : undefined;
      onError(messageForArchiveCode(code, fallback, t));
    } finally {
      setPending(false);
    }
  }

  return { pending, run };
}

export function ArchiveSubjectButton({
  subjectCode,
  t,
  onDone,
  onError,
}: {
  subjectCode: string;
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useConfirmAction(onDone, onError);

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <Icon.Archive size={14} />
        {t.archiveSubject}
      </button>
      {open ? (
        <ConfirmDialog
          titleId={`archive-subject-${subjectCode}`}
          title={t.archiveSubject}
          body={t.archiveSubjectConfirm}
          confirmLabel={pending ? t.archiveWorking : t.archiveSubject}
          pending={pending}
          cancelLabel={t.cancel}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            void run(
              `/api/subjects/${encodeURIComponent(subjectCode)}/archive`,
              "POST",
              t.archiveSubjectDone,
              t,
            ).then(() => setOpen(false));
          }}
        />
      ) : null}
    </>
  );
}

export function ArchiveClassButton({
  classSubjectId,
  t,
  onDone,
  onError,
}: {
  classSubjectId: string;
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useConfirmAction(onDone, onError);

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Icon.Archive size={14} />
        {t.archiveClass}
      </button>
      {open ? (
        <ConfirmDialog
          titleId={`archive-class-${classSubjectId}`}
          title={t.archiveClass}
          body={t.archiveClassConfirm}
          confirmLabel={pending ? t.archiveWorking : t.archiveClass}
          pending={pending}
          cancelLabel={t.cancel}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            void run(
              `/api/class-subjects/${encodeURIComponent(classSubjectId)}/archive`,
              "POST",
              t.archiveClassDone,
              t,
            ).then(() => setOpen(false));
          }}
        />
      ) : null}
    </>
  );
}

function RestoreDeleteButtons({
  restoreUrl,
  deleteUrl,
  restoreTitle,
  restoreBody,
  deleteTitle,
  confirmToken,
  examCount,
  submissionCount,
  restoreDone,
  deleteDone,
  t,
  onDone,
  onError,
}: {
  restoreUrl: string;
  deleteUrl: string;
  restoreTitle: string;
  restoreBody: string;
  deleteTitle: string;
  confirmToken: string;
  examCount: number;
  submissionCount: number;
  restoreDone: string;
  deleteDone: string;
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<"restore" | "delete" | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { pending, run } = useConfirmAction(
    (message) => {
      setMode(null);
      setDeleteError(null);
      onDone(message);
    },
    (message) => {
      if (mode === "delete") {
        setDeleteError(message);
        return;
      }
      setMode(null);
      onError(message);
    },
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setMode("restore")}>
          <Icon.RotateCcw size={14} />
          {t.restoreUse}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            setDeleteError(null);
            setMode("delete");
          }}
        >
          {t.deleteForever}
        </button>
      </div>
      {mode === "restore" ? (
        <ConfirmDialog
          titleId={`restore-${restoreUrl}`}
          title={restoreTitle}
          body={restoreBody}
          confirmLabel={pending ? t.archiveWorking : t.restoreUse}
          pending={pending}
          cancelLabel={t.cancel}
          onCancel={() => setMode(null)}
          onConfirm={() => {
            void run(restoreUrl, "POST", restoreDone, t);
          }}
        />
      ) : null}
      {mode === "delete" ? (
        <AdminDeleteDialog
          t={t}
          title={deleteTitle}
          impact={teacherDeleteImpact(t, { examCount, submissionCount })}
          confirmToken={confirmToken}
          pending={pending}
          errorMessage={deleteError}
          onConfirm={() => {
            void run(deleteUrl, "DELETE", deleteDone, t, { confirm: confirmToken });
          }}
          onCancel={() => {
            if (!pending) {
              setMode(null);
              setDeleteError(null);
            }
          }}
        />
      ) : null}
    </>
  );
}

export function ArchivedClassesMenu({
  subjectCode,
  classes,
  t,
  onDone,
  onError,
}: {
  subjectCode: string;
  classes: Array<{
    id: string;
    name: string;
    archivedAt: string;
    examCount?: number;
    submissionCount?: number;
  }>;
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (classes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-amber-950"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2">
          <Icon.Archive size={15} />
          {t.archivedClasses}
          <span className="badge badge-neutral">{classes.length}</span>
        </span>
        <Icon.ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-amber-200 px-4 py-3">
          {classes.map((cls) => (
            <li
              key={cls.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-3"
            >
              <div>
                <p className="font-semibold text-[var(--ink)]">
                  {t.classGroup} {cls.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {t.archivedOn} {cls.archivedAt}
                </p>
              </div>
              <RestoreDeleteButtons
                restoreUrl={`/api/class-subjects/${encodeURIComponent(cls.id)}/restore`}
                deleteUrl={`/api/class-subjects/${encodeURIComponent(cls.id)}`}
                restoreTitle={t.restoreUse}
                restoreBody={t.restoreClassConfirm}
                deleteTitle={t.deleteForever}
                confirmToken={cls.name}
                examCount={cls.examCount ?? 0}
                submissionCount={cls.submissionCount ?? 0}
                restoreDone={t.restoreClassDone}
                deleteDone={t.deleteClassDone}
                t={t}
                onDone={onDone}
                onError={onError}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <span className="sr-only">{subjectCode}</span>
    </div>
  );
}

export function ArchivedSubjectCard({
  subject,
  t,
  onDone,
  onError,
}: {
  subject: {
    subjectCode: string;
    archivedAt: string;
    examCount?: number;
    submissionCount?: number;
    classes: Array<{ id: string; name: string; individuallyArchived: boolean }>;
  };
  t: Dictionary;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="icon-tile">
            <Icon.Archive size={18} />
          </span>
          <div>
            <p className="eyebrow">{t.subjectGroup}</p>
            <h2 className="text-lg font-bold text-[var(--ink)]">{subject.subjectCode}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {t.archivedOn} {subject.archivedAt}
            </p>
          </div>
        </div>
        <RestoreDeleteButtons
          restoreUrl={`/api/subjects/${encodeURIComponent(subject.subjectCode)}/restore`}
          deleteUrl={`/api/subjects/${encodeURIComponent(subject.subjectCode)}`}
          restoreTitle={t.restoreUse}
          restoreBody={t.restoreSubjectConfirm}
          deleteTitle={t.deleteForever}
          confirmToken={subject.subjectCode}
          examCount={subject.examCount ?? 0}
          submissionCount={subject.submissionCount ?? 0}
          restoreDone={t.restoreSubjectDone}
          deleteDone={t.deleteSubjectDone}
          t={t}
          onDone={onDone}
          onError={onError}
        />
      </header>
      <ul className="divide-y divide-[var(--border)]">
        {subject.classes.map((cls) => (
          <li key={cls.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
            <p className="text-sm font-semibold text-[var(--ink)]">
              {t.classGroup} {cls.name}
            </p>
            {cls.individuallyArchived ? (
              <span className="badge badge-warn">{t.archivedIndividually}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
