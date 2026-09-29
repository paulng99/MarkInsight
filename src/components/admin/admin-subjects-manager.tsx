"use client";

import { useCallback, useEffect, useState, useTransition, type CSSProperties } from "react";
import { AdminDeleteDialog } from "@/components/admin/admin-delete-dialog";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import {
  fillDeleteImpactTemplate,
  sumClassImpact,
  sumClassesImpact,
} from "@/lib/admin/delete-confirm";
import type {
  AdminClassSubjectDto,
  AdminSubjectGroupDto,
} from "@/lib/admin/class-subjects";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type Props = {
  locale: Locale;
  t: Dictionary;
  schoolId: string;
};

type DeleteDialogState =
  | {
      kind: "class";
      group: AdminSubjectGroupDto;
      cls: AdminClassSubjectDto;
    }
  | {
      kind: "subject";
      group: AdminSubjectGroupDto;
    }
  | {
      kind: "archived";
    };

export function AdminSubjectsManager({ t, schoolId }: Props) {
  const [subjects, setSubjects] = useState<AdminSubjectGroupDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(true);
  const [pending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(
    null,
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/class-subjects?schoolId=${encodeURIComponent(schoolId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.adminSubjectsErrorLoad);
        setSubjects([]);
        return;
      }
      setSubjects(data.subjects ?? []);
    } catch {
      setError(t.adminSubjectsErrorLoad);
      setSubjects([]);
    }
  }, [schoolId, t.adminSubjectsErrorLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  function run(action: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        await action();
        setDeleteDialog(null);
        setNotice(successMsg);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : t.adminSubjectsErrorAction);
      }
    });
  }

  async function patchClass(cls: AdminClassSubjectDto, archived: boolean) {
    const res = await fetch(`/api/admin/class-subjects/${cls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived, schoolId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.adminSubjectsErrorAction);
  }

  async function deleteClass(cls: AdminClassSubjectDto) {
    const res = await fetch(
      `/api/admin/class-subjects/${cls.id}?schoolId=${encodeURIComponent(schoolId)}`,
      { method: "DELETE" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t.adminSubjectsErrorAction);
  }

  async function patchSubject(subjectCode: string, archived: boolean) {
    const res = await fetch(
      `/api/admin/subjects/${encodeURIComponent(subjectCode)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived, schoolId }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.adminSubjectsErrorAction);
  }

  async function deleteSubject(subjectCode: string) {
    const res = await fetch(
      `/api/admin/subjects/${encodeURIComponent(subjectCode)}?schoolId=${encodeURIComponent(schoolId)}`,
      { method: "DELETE" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t.adminSubjectsErrorAction);
  }

  async function bulk(action: "archive_all" | "delete_archived") {
    const res = await fetch("/api/admin/class-subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, schoolId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.adminSubjectsErrorAction);
  }

  if (!subjects) {
    return <LoadingBlock label={t.adminSubjectsLoading} className="mt-8" />;
  }

  const visible = subjects
    .map((g) => ({
      ...g,
      classes: g.classes.filter((c) => showArchived || !c.archivedAt),
    }))
    .filter((g) => g.classes.length > 0 || g.hasSyllabus);

  const activeTotal = subjects.reduce((n, g) => n + g.activeClassCount, 0);
  const archivedTotal = subjects.reduce((n, g) => n + g.archivedClassCount, 0);
  const archivedClasses = subjects.flatMap((g) =>
    g.classes.filter((c) => c.archivedAt),
  );

  let deleteDialogView: {
    title: string;
    impact: string;
    confirmToken: string;
    onConfirm: () => void;
    onArchiveInstead?: () => void;
  } | null = null;

  if (deleteDialog?.kind === "class") {
    const counts = sumClassImpact(deleteDialog.cls);
    deleteDialogView = {
      title: t.adminSubjectsDeleteDialogTitleClass,
      impact: fillDeleteImpactTemplate(t.adminSubjectsDeleteImpactClass, counts),
      confirmToken: deleteDialog.cls.name,
      onConfirm: () =>
        run(
          () => deleteClass(deleteDialog.cls),
          t.adminSubjectsDeleteClassSuccess,
        ),
      onArchiveInstead: deleteDialog.cls.archivedAt
        ? undefined
        : () =>
            run(
              () => patchClass(deleteDialog.cls, true),
              t.adminSubjectsArchiveClassSuccess,
            ),
    };
  } else if (deleteDialog?.kind === "subject") {
    const counts = sumClassesImpact(deleteDialog.group.classes);
    deleteDialogView = {
      title: t.adminSubjectsDeleteDialogTitleSubject,
      impact: fillDeleteImpactTemplate(
        t.adminSubjectsDeleteImpactSubject,
        counts,
      ),
      confirmToken: deleteDialog.group.subjectCode,
      onConfirm: () =>
        run(
          () => deleteSubject(deleteDialog.group.subjectCode),
          t.adminSubjectsDeleteSubjectSuccess,
        ),
      onArchiveInstead:
        deleteDialog.group.activeClassCount > 0
          ? () =>
              run(
                () => patchSubject(deleteDialog.group.subjectCode, true),
                t.adminSubjectsArchiveSubjectSuccess,
              )
          : undefined,
    };
  } else if (deleteDialog?.kind === "archived") {
    const counts = sumClassesImpact(archivedClasses);
    deleteDialogView = {
      title: t.adminSubjectsDeleteDialogTitleArchived,
      impact: fillDeleteImpactTemplate(
        t.adminSubjectsDeleteImpactArchived,
        counts,
      ),
      confirmToken: t.adminSubjectsDeleteConfirmWord,
      onConfirm: () =>
        run(
          () => bulk("delete_archived"),
          t.adminSubjectsDeleteArchivedSuccess,
        ),
    };
  }

  return (
    <div className="mt-8 space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--border)] text-primary-600"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t.adminSubjectsShowArchived}
          {archivedTotal > 0 ? (
            <span className="badge badge-neutral">{archivedTotal}</span>
          ) : null}
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending || activeTotal === 0}
            onClick={() => {
              if (!window.confirm(t.adminSubjectsConfirmArchiveAll)) return;
              run(
                () => bulk("archive_all"),
                t.adminSubjectsArchiveAllSuccess,
              );
            }}
          >
            <Icon.Archive size={16} />
            {t.adminSubjectsArchiveAll}
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost btn-sm"
            disabled={pending || archivedTotal === 0}
            onClick={() => setDeleteDialog({ kind: "archived" })}
          >
            <Icon.Trash size={16} />
            {t.adminSubjectsDeleteArchived}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={t.adminSubjectsEmpty} />
      ) : (
        visible.map((group) => (
          <section key={group.subjectCode} className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className="icon-tile"
                  style={
                    {
                      ["--tile-bg" as string]: "var(--role-admin-soft)",
                      ["--tile-fg" as string]: "var(--role-admin)",
                    } as CSSProperties
                  }
                >
                  <Icon.BookOpen size={18} />
                </span>
                <div>
                  <p className="eyebrow">{t.subjectGroup}</p>
                  <h2 className="text-lg font-bold text-[var(--ink)]">
                    {group.subjectCode}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {group.activeClassCount} {t.adminSubjectsActiveClasses}
                    {group.archivedClassCount > 0
                      ? ` · ${group.archivedClassCount} ${t.adminSubjectsArchivedClasses}`
                      : ""}
                    {group.hasSyllabus
                      ? ` · ${t.syllabusTitle}${
                          group.syllabusOriginalName
                            ? `: ${group.syllabusOriginalName}`
                            : ""
                        }`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.activeClassCount > 0 ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => patchSubject(group.subjectCode, true),
                        t.adminSubjectsArchiveSubjectSuccess,
                      )
                    }
                  >
                    <Icon.Archive size={14} />
                    {t.adminSubjectsArchiveSubject}
                  </button>
                ) : null}
                {group.archivedClassCount > 0 ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => patchSubject(group.subjectCode, false),
                        t.adminSubjectsRestoreSubjectSuccess,
                      )
                    }
                  >
                    <Icon.Refresh size={14} />
                    {t.adminSubjectsRestoreSubject}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-danger-ghost btn-sm"
                  disabled={pending}
                  onClick={() => setDeleteDialog({ kind: "subject", group })}
                >
                  <Icon.Trash size={14} />
                  {t.adminSubjectsDeleteSubject}
                </button>
              </div>
            </div>

            {group.classes.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                {t.adminSubjectsNoClasses}
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-[var(--border)]">
                {group.classes.map((cls) => {
                  const archived = Boolean(cls.archivedAt);
                  return (
                    <li
                      key={cls.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--ink)]">
                            {t.classGroup} {cls.name}
                          </p>
                          {archived ? (
                            <span className="badge badge-neutral">
                              {t.adminSubjectsArchivedBadge}
                              {cls.archivedAt ? ` · ${cls.archivedAt}` : ""}
                            </span>
                          ) : (
                            <span className="badge badge-info">
                              {t.adminSubjectsActiveBadge}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">
                          {cls.schoolYearName}
                          {" · "}
                          {cls.enrollmentCount} {t.adminSubjectsEnrollments}
                          {" · "}
                          {cls.examCount}{" "}
                          {cls.examCount === 1
                            ? t.examsCountOne
                            : t.examsCount}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {archived ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => patchClass(cls, false),
                                t.adminSubjectsRestoreClassSuccess,
                              )
                            }
                          >
                            <Icon.Refresh size={14} />
                            {t.adminSubjectsRestoreClass}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => patchClass(cls, true),
                                t.adminSubjectsArchiveClassSuccess,
                              )
                            }
                          >
                            <Icon.Archive size={14} />
                            {t.adminSubjectsArchiveClass}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          disabled={pending}
                          onClick={() =>
                            setDeleteDialog({ kind: "class", group, cls })
                          }
                        >
                          <Icon.Trash size={14} />
                          {t.adminSubjectsDeleteClass}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}

      {deleteDialogView ? (
        <AdminDeleteDialog
          t={t}
          title={deleteDialogView.title}
          impact={deleteDialogView.impact}
          confirmToken={deleteDialogView.confirmToken}
          pending={pending}
          onConfirm={deleteDialogView.onConfirm}
          onArchiveInstead={deleteDialogView.onArchiveInstead}
          onCancel={() => {
            if (!pending) setDeleteDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
