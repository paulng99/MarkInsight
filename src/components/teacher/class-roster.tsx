"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { RosterAddResult } from "@/lib/enrollments/roster";
import { Alert } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

type StudentRow = { id: string; name: string | null; email: string };
type PendingRow = { email: string; createdAt: string };

function resultLabel(row: RosterAddResult, t: Dictionary): string {
  if (row.status === "enrolled") return t.rosterEnrolledStatus;
  if (row.status === "pending") return t.rosterPendingStatus;
  if (row.status === "already") return t.rosterAlready;
  if (row.code === "not_student") return t.rosterRejectedNotStudent;
  if (row.code === "other_school") return t.rosterRejectedOtherSchool;
  return t.rosterRejectedInvalid;
}

export function ClassRoster({
  classSubjectId,
  className,
  t,
  locale,
  initialOpen = false,
}: {
  classSubjectId: string;
  className: string;
  t: Dictionary;
  locale?: Locale;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [emails, setEmails] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [results, setResults] = useState<RosterAddResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/class-subjects/${encodeURIComponent(classSubjectId)}/students`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.addStudentsError);
        return;
      }
      setStudents(data.students ?? []);
      setPending(data.pending ?? []);
    } catch {
      setError(t.addStudentsError);
    } finally {
      setLoading(false);
    }
  }, [classSubjectId, t.addStudentsError]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/class-subjects/${encodeURIComponent(classSubjectId)}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.addStudentsError);
        return;
      }
      setStudents(data.students ?? []);
      setPending(data.pending ?? []);
      setResults(data.results ?? []);
      setEmails("");
    } catch {
      setError(t.addStudentsError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon.Users size={14} />
        {t.addStudents}
      </button>

      {open ? (
        <div className="card card-pad mt-3 space-y-4 border-primary-100 bg-primary-50/40">
          <div>
            <p className="font-semibold text-[var(--ink)]">
              {t.classGroup} {className}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.addStudentsHint}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="label" htmlFor={`emails-${classSubjectId}`}>
              {t.email}
            </label>
            <textarea
              id={`emails-${classSubjectId}`}
              required
              rows={3}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={t.addStudentsPlaceholder}
              className="input min-h-24 resize-y"
            />
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? <Icon.Loader size={14} /> : <Icon.Plus size={14} />}
              {saving ? t.addStudentsSaving : t.addStudentsSubmit}
            </button>
          </form>

          {error ? <Alert tone="error">{error}</Alert> : null}

          {results && results.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {results.map((row) => (
                <li key={row.email} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--ink)]">{row.email}</span>
                  <span
                    className={`badge ${
                      row.status === "rejected"
                        ? "badge-warn"
                        : row.status === "pending"
                          ? "badge-info"
                          : "badge-success"
                    }`}
                  >
                    {resultLabel(row, t)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {loading ? (
            <p className="text-sm text-[var(--muted)]">{t.addStudentsSaving}</p>
          ) : students.length === 0 && pending.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t.rosterEmpty}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {t.rosterEnrolled}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {students.map((student) => (
                    <li key={student.id} className="text-[var(--ink)]">
                      <span className="font-medium">{student.name || student.email}</span>
                      <span className="ml-2 text-[var(--muted)]">{student.email}</span>
                      {locale ? (
                        <Link
                          href={`/teacher/class-subjects/${classSubjectId}/students/${student.id}/weakness?locale=${locale}`}
                          className="mt-0.5 block text-xs font-semibold text-primary-700"
                        >
                          {t.crossExamWeaknessTitle}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {t.rosterPending}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {pending.map((row) => (
                    <li key={row.email} className="text-[var(--ink)]">
                      <span className="font-medium">{row.email}</span>
                      <span className="ml-2 text-[var(--muted)]">{row.createdAt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
