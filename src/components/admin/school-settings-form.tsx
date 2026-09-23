"use client";

import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type {
  SchoolSettingsPageDto,
  TeacherAccountDto,
} from "@/lib/school-settings/types";
import { useState, useTransition } from "react";

type FormState = "empty" | "default" | "error" | "success";

type Props = {
  locale: Locale;
  t: Dictionary;
  initialPage: SchoolSettingsPageDto | null;
  initialError: string | null;
};

type FormFields = {
  displayName: string;
  contactNote: string;
  defaultSchoolYearId: string;
  analysisLlmModel: string;
  allowTeacherCreateStudents: boolean;
  allowTeacherUploadOnBehalf: boolean;
};

function fieldsFromPage(page: SchoolSettingsPageDto): FormFields {
  if (!page.settings) {
    return {
      displayName: page.schoolName,
      contactNote: "",
      defaultSchoolYearId: page.schoolYears[0]?.id ?? "",
      analysisLlmModel: page.analysisModelAllowlist[0] ?? "",
      allowTeacherCreateStudents: false,
      allowTeacherUploadOnBehalf: false,
    };
  }
  return {
    displayName: page.settings.displayName,
    contactNote: page.settings.contactNote ?? "",
    defaultSchoolYearId: page.settings.defaultSchoolYearId ?? "",
    analysisLlmModel: page.settings.analysisLlmModel,
    allowTeacherCreateStudents: page.settings.allowTeacherCreateStudents,
    allowTeacherUploadOnBehalf: page.settings.allowTeacherUploadOnBehalf,
  };
}

export function SchoolSettingsForm({
  locale,
  t,
  initialPage,
  initialError,
}: Props) {
  const [page, setPage] = useState<SchoolSettingsPageDto | null>(initialPage);
  const [state, setState] = useState<FormState>(() => {
    if (initialError || !initialPage) return "error";
    return initialPage.settings ? "default" : "empty";
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [banner, setBanner] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFields>(() =>
    initialPage
      ? fieldsFromPage(initialPage)
      : {
          displayName: "",
          contactNote: "",
          defaultSchoolYearId: "",
          analysisLlmModel: "",
          allowTeacherCreateStudents: false,
          allowTeacherUploadOnBehalf: false,
        },
  );
  const [schoolYears, setSchoolYears] = useState(
    initialPage?.schoolYears ?? [],
  );
  const [teachers, setTeachers] = useState<TeacherAccountDto[]>(
    initialPage?.teachers ?? [],
  );
  const [allowlist, setAllowlist] = useState(
    initialPage?.analysisModelAllowlist ?? [],
  );
  const [schoolId, setSchoolId] = useState(initialPage?.schoolId ?? "");
  const [schoolName, setSchoolName] = useState(initialPage?.schoolName ?? "");
  const [saving, setSaving] = useState(false);
  const [newYearName, setNewYearName] = useState("");
  const [addingYear, setAddingYear] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();

  function applyPage(next: SchoolSettingsPageDto) {
    setPage(next);
    setSchoolId(next.schoolId);
    setSchoolName(next.schoolName);
    setSchoolYears(next.schoolYears);
    setTeachers(next.teachers);
    setAllowlist(next.analysisModelAllowlist);
    setFields(fieldsFromPage(next));
    setState(next.settings ? "default" : "empty");
    setErrorMessage(null);
  }

  function refresh() {
    startRefresh(async () => {
      setBanner(null);
      try {
        const qs = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
        const res = await fetch(`/api/admin/school-settings${qs}`, {
          credentials: "same-origin",
        });
        const data = (await res.json()) as SchoolSettingsPageDto & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || t.settingsErrorLoad);
        }
        applyPage(data);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : t.settingsErrorLoad,
        );
        setState("error");
      }
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/school-settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          displayName: fields.displayName,
          contactNote: fields.contactNote || null,
          defaultSchoolYearId: fields.defaultSchoolYearId || null,
          analysisLlmModel: fields.analysisLlmModel,
          allowTeacherCreateStudents: fields.allowTeacherCreateStudents,
          allowTeacherUploadOnBehalf: fields.allowTeacherUploadOnBehalf,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        settings?: NonNullable<SchoolSettingsPageDto["settings"]>;
      };
      if (!res.ok) {
        throw new Error(data.error || t.settingsErrorSave);
      }
      setBanner(t.settingsSuccess);
      setState("success");
      if (data.settings) {
        setFields({
          displayName: data.settings.displayName,
          contactNote: data.settings.contactNote ?? "",
          defaultSchoolYearId: data.settings.defaultSchoolYearId ?? "",
          analysisLlmModel: data.settings.analysisLlmModel,
          allowTeacherCreateStudents: data.settings.allowTeacherCreateStudents,
          allowTeacherUploadOnBehalf: data.settings.allowTeacherUploadOnBehalf,
        });
        setSchoolName(data.settings.displayName);
        setPage((prev) =>
          prev ? { ...prev, settings: data.settings!, schoolName: data.settings!.displayName } : prev,
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.settingsErrorSave);
      setState("error");
    } finally {
      setSaving(false);
    }
  }

  async function onAddYear() {
    setAddingYear(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/school-years", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, name: newYearName }),
      });
      const data = (await res.json()) as {
        error?: string;
        year?: SchoolSettingsPageDto["schoolYears"][number];
      };
      if (!res.ok) {
        throw new Error(data.error || t.settingsErrorYear);
      }
      if (data.year) {
        setSchoolYears((prev) => [data.year!, ...prev]);
        setFields((prev) => ({
          ...prev,
          defaultSchoolYearId: data.year!.id,
        }));
      }
      setNewYearName("");
      setBanner(t.settingsYearSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.settingsErrorYear);
    } finally {
      setAddingYear(false);
    }
  }

  async function onCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTeacher(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          email: teacherEmail,
          name: teacherName,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        teacher?: TeacherAccountDto;
      };
      if (!res.ok) {
        throw new Error(data.error || t.settingsErrorTeacher);
      }
      if (data.teacher) {
        setTeachers((prev) =>
          [...prev, data.teacher!].sort((a, b) =>
            a.email.localeCompare(b.email),
          ),
        );
      }
      setTeacherName("");
      setTeacherEmail("");
      setBanner(t.settingsTeacherSuccess);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t.settingsErrorTeacher,
      );
    } finally {
      setCreatingTeacher(false);
    }
  }

  if (state === "error" && !page) {
    return (
      <div
        className="mt-8 rounded-lg border border-[var(--color-error)]/40 bg-[var(--surface)] px-5 py-8"
        role="alert"
      >
        <p className="text-[var(--color-error)]">
          {errorMessage ?? t.settingsErrorLoad}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing}
          className="mt-4 text-sm font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
        >
          {isRefreshing ? t.settingsLoading : t.settingsRetry}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {state === "empty" ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          {t.settingsEmpty}
        </p>
      ) : null}

      {banner ? (
        <p
          className="rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/8 px-4 py-3 text-sm text-[var(--color-success)] transition-opacity duration-[var(--motion-success)]"
          role="status"
        >
          {banner}
        </p>
      ) : null}

      {errorMessage && page ? (
        <p
          className="rounded-md border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 px-4 py-3 text-sm text-[var(--color-error)]"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <p className="text-sm text-[var(--muted)]">
        {schoolName ? `${schoolName} · ` : ""}
        <span className="font-mono text-xs">{schoolId}</span>
        <span className="sr-only"> locale {locale}</span>
      </p>

      <form onSubmit={onSave} className="space-y-10">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.settingsSectionSchool}
          </h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              {t.settingsFieldDisplayName}
            </span>
            <input
              required
              value={fields.displayName}
              onChange={(e) =>
                setFields((f) => ({ ...f, displayName: e.target.value }))
              }
              className="w-full max-w-xl rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none transition-[border-color] duration-[var(--motion-fast)] focus:border-[var(--brand)]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              {t.settingsFieldContact}
            </span>
            <textarea
              value={fields.contactNote}
              onChange={(e) =>
                setFields((f) => ({ ...f, contactNote: e.target.value }))
              }
              rows={3}
              className="w-full max-w-xl rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none transition-[border-color] duration-[var(--motion-fast)] focus:border-[var(--brand)]"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.settingsSectionYear}
          </h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              {t.settingsFieldYear}
            </span>
            <select
              value={fields.defaultSchoolYearId}
              onChange={(e) =>
                setFields((f) => ({
                  ...f,
                  defaultSchoolYearId: e.target.value,
                }))
              }
              className="w-full max-w-xl rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            >
              <option value="">{t.settingsFieldYearPlaceholder}</option>
              {schoolYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.startsOn} → {y.endsOn})
                </option>
              ))}
            </select>
          </label>

          <div className="max-w-xl space-y-2 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t.settingsFieldYearCreateLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                placeholder="2026-2027"
                className="min-w-[12rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                aria-label={t.settingsFieldYearName}
              />
              <button
                type="button"
                disabled={addingYear || !newYearName.trim()}
                onClick={() => void onAddYear()}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--brand-deep)] transition-colors duration-[var(--motion-fast)] hover:border-[var(--brand)] disabled:opacity-50"
              >
                {addingYear ? "…" : t.settingsFieldYearAdd}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.settingsSectionModel}
          </h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              {t.settingsFieldModel}
            </span>
            <select
              required
              value={fields.analysisLlmModel}
              onChange={(e) =>
                setFields((f) => ({ ...f, analysisLlmModel: e.target.value }))
              }
              className="w-full max-w-xl rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            >
              {allowlist.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <p className="max-w-xl text-xs leading-relaxed text-[var(--muted)]">
            {t.settingsFieldModelHelp}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
            {t.settingsSectionPermissions}
          </h2>
          <label className="flex max-w-xl cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={fields.allowTeacherCreateStudents}
              onChange={(e) =>
                setFields((f) => ({
                  ...f,
                  allowTeacherCreateStudents: e.target.checked,
                }))
              }
              className="mt-1 size-4 accent-[var(--brand)]"
            />
            <span className="text-sm text-[var(--ink)]">
              {t.settingsFieldTeacherStudents}
            </span>
          </label>
          <label className="flex max-w-xl cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={fields.allowTeacherUploadOnBehalf}
              onChange={(e) =>
                setFields((f) => ({
                  ...f,
                  allowTeacherUploadOnBehalf: e.target.checked,
                }))
              }
              className="mt-1 size-4 accent-[var(--brand)]"
            />
            <span className="text-sm text-[var(--ink)]">
              {t.settingsFieldTeacherUpload}
            </span>
          </label>
        </section>

        <div className="border-t border-[var(--border)] pt-6">
          <button
            type="submit"
            disabled={
              saving || !fields.displayName.trim() || !fields.analysisLlmModel
            }
            className="rounded-md bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-[var(--motion-fast)] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t.settingsSaving : t.settingsSave}
          </button>
        </div>
      </form>

      <section className="space-y-4 border-t border-[var(--border)] pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-deep)]">
          {t.settingsSectionTeachers}
        </h2>
        <p className="max-w-xl text-sm text-[var(--muted)]">
          {t.settingsTeachersIntro}
        </p>

        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">
            {t.settingsTeacherList}
          </h3>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t.settingsTeacherEmpty}
            </p>
          ) : (
            <ul className="mt-2 max-w-xl divide-y divide-[var(--border)]">
              {teachers.map((teacher) => (
                <li
                  key={teacher.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--ink)]">
                    {teacher.name ?? "—"}
                  </span>
                  <span className="text-[var(--muted)]">{teacher.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={onCreateTeacher}
          className="flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block min-w-[10rem] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              {t.settingsTeacherName}
            </span>
            <input
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="block min-w-[12rem] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              {t.settingsTeacherEmail}
            </span>
            <input
              required
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <button
            type="submit"
            disabled={creatingTeacher}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--brand-deep)] transition-colors duration-[var(--motion-fast)] hover:border-[var(--brand)] disabled:opacity-50"
          >
            {creatingTeacher ? "…" : t.settingsTeacherCreate}
          </button>
        </form>
      </section>
    </div>
  );
}
