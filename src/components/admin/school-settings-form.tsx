"use client";

import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type {
  SchoolSettingsPageDto,
  TeacherAccountDto,
} from "@/lib/school-settings/types";
import { useState, useTransition, type ReactNode } from "react";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

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

function SettingsSection({
  id,
  icon,
  title,
  description,
  children,
  tint,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  tint?: { bg: string; fg: string };
}) {
  return (
    <section id={id} className="card card-pad scroll-mt-24">
      <div className="flex items-start gap-3">
        <span
          className="icon-tile"
          style={
            tint
              ? ({ ["--tile-bg" as string]: tint.bg, ["--tile-fg" as string]: tint.fg } as React.CSSProperties)
              : undefined
          }
        >
          {icon}
        </span>
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors ${
        checked
          ? "border-primary-200 bg-primary-50"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
      }`}
    >
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-[var(--slate-300)] transition-colors peer-checked:bg-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
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
  const [schoolYears, setSchoolYears] = useState(initialPage?.schoolYears ?? []);
  const [teachers, setTeachers] = useState<TeacherAccountDto[]>(initialPage?.teachers ?? []);
  const [allowlist, setAllowlist] = useState(initialPage?.analysisModelAllowlist ?? []);
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
        const data = (await res.json()) as SchoolSettingsPageDto & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || t.settingsErrorLoad);
        }
        applyPage(data);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : t.settingsErrorLoad);
        setState("error");
      }
    });
  }

  async function onSave(e?: { preventDefault(): void }) {
    e?.preventDefault();
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
        setFields((prev) => ({ ...prev, defaultSchoolYearId: data.year!.id }));
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
        body: JSON.stringify({ schoolId, email: teacherEmail, name: teacherName }),
      });
      const data = (await res.json()) as { error?: string; teacher?: TeacherAccountDto };
      if (!res.ok) {
        throw new Error(data.error || t.settingsErrorTeacher);
      }
      if (data.teacher) {
        setTeachers((prev) =>
          [...prev, data.teacher!].sort((a, b) => a.email.localeCompare(b.email)),
        );
      }
      setTeacherName("");
      setTeacherEmail("");
      setBanner(t.settingsTeacherSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.settingsErrorTeacher);
    } finally {
      setCreatingTeacher(false);
    }
  }

  if (state === "error" && !page) {
    return (
      <Alert
        tone="error"
        className="mt-8"
        action={
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
          >
            {isRefreshing ? <Icon.Loader size={14} /> : <Icon.Refresh size={14} />}
            {isRefreshing ? t.settingsLoading : t.settingsRetry}
          </button>
        }
      >
        {errorMessage ?? t.settingsErrorLoad}
      </Alert>
    );
  }

  const canSave = !saving && fields.displayName.trim().length > 0 && Boolean(fields.analysisLlmModel);
  const violet = { bg: "var(--role-admin-soft)", fg: "var(--role-admin)" };

  return (
    <div className="mt-8 space-y-6">
      {state === "empty" ? <Alert tone="info">{t.settingsEmpty}</Alert> : null}
      {banner ? <Alert tone="success">{banner}</Alert> : null}
      {errorMessage && page ? <Alert tone="error">{errorMessage}</Alert> : null}
      <span className="sr-only">locale {locale}</span>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <form onSubmit={onSave} className="space-y-6 animate-fade-up-delay">
          <SettingsSection icon={<Icon.School size={18} />} title={t.settingsSectionSchool} tint={violet}>
            <div>
              <label className="label" htmlFor="display-name">
                {t.settingsFieldDisplayName}
              </label>
              <input
                id="display-name"
                required
                value={fields.displayName}
                onChange={(e) => setFields((f) => ({ ...f, displayName: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="contact-note">
                {t.settingsFieldContact}
              </label>
              <textarea
                id="contact-note"
                value={fields.contactNote}
                onChange={(e) => setFields((f) => ({ ...f, contactNote: e.target.value }))}
                rows={3}
                className="textarea"
              />
            </div>
          </SettingsSection>

          <SettingsSection icon={<Icon.Calendar size={18} />} title={t.settingsSectionYear}>
            <div>
              <label className="label" htmlFor="default-year">
                {t.settingsFieldYear}
              </label>
              <select
                id="default-year"
                value={fields.defaultSchoolYearId}
                onChange={(e) => setFields((f) => ({ ...f, defaultSchoolYearId: e.target.value }))}
                className="select"
              >
                <option value="">{t.settingsFieldYearPlaceholder}</option>
                {schoolYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} ({y.startsOn} → {y.endsOn})
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4">
              <p className="label">{t.settingsFieldYearCreateLabel}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  placeholder="2026-2027"
                  className="input min-w-[12rem] flex-1"
                  aria-label={t.settingsFieldYearName}
                />
                <button
                  type="button"
                  disabled={addingYear || !newYearName.trim()}
                  onClick={() => void onAddYear()}
                  className="btn btn-secondary"
                >
                  {addingYear ? <Icon.Loader size={16} /> : <Icon.Plus size={16} />}
                  {t.settingsFieldYearAdd}
                </button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Icon.Sparkles size={18} />}
            title={t.settingsSectionModel}
            description={t.settingsFieldModelHelp}
            tint={{ bg: "#e3f6f3", fg: "var(--teal-600)" }}
          >
            <div>
              <label className="label" htmlFor="analysis-model">
                {t.settingsFieldModel}
              </label>
              <select
                id="analysis-model"
                required
                value={fields.analysisLlmModel}
                onChange={(e) => setFields((f) => ({ ...f, analysisLlmModel: e.target.value }))}
                className="select font-mono text-sm"
              >
                {allowlist.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Icon.Shield size={18} />}
            title={t.settingsSectionPermissions}
            tint={{ bg: "#fff4e0", fg: "var(--amber-600)" }}
          >
            <Toggle
              checked={fields.allowTeacherCreateStudents}
              onChange={(v) => setFields((f) => ({ ...f, allowTeacherCreateStudents: v }))}
              label={t.settingsFieldTeacherStudents}
            />
            <Toggle
              checked={fields.allowTeacherUploadOnBehalf}
              onChange={(v) => setFields((f) => ({ ...f, allowTeacherUploadOnBehalf: v }))}
              label={t.settingsFieldTeacherUpload}
            />
          </SettingsSection>

          <div className="flex justify-end lg:hidden">
            <button type="submit" disabled={!canSave} className="btn btn-primary">
              {saving ? <Icon.Loader size={16} /> : <Icon.Check size={16} />}
              {saving ? t.settingsSaving : t.settingsSave}
            </button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-8 animate-fade-up-delay-2">
          <div className="card card-pad">
            <p className="eyebrow">{t.settingsSectionSchool}</p>
            <p className="mt-2 text-lg font-bold text-[var(--ink)]">{schoolName || "—"}</p>
            <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">{schoolId}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[var(--muted)]">{t.settingsSectionYear}</dt>
                <dd className="font-semibold text-[var(--ink)]">{schoolYears.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[var(--muted)]">{t.settingsTeacherList}</dt>
                <dd className="font-semibold text-[var(--ink)]">{teachers.length}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!canSave}
              className="btn btn-primary mt-5 hidden w-full lg:inline-flex"
            >
              {saving ? <Icon.Loader size={16} /> : <Icon.Check size={16} />}
              {saving ? t.settingsSaving : t.settingsSave}
            </button>
          </div>
        </aside>
      </div>

      <SettingsSection
        id="teachers"
        icon={<Icon.Users size={18} />}
        title={t.settingsSectionTeachers}
        description={t.settingsTeachersIntro}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="label">{t.settingsTeacherList}</h3>
            {teachers.length === 0 ? (
              <EmptyState compact title={t.settingsTeacherEmpty} />
            ) : (
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                {teachers.map((teacher) => (
                  <li key={teacher.id} className="flex items-center gap-3 bg-[var(--surface)] px-3 py-2.5 text-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--role-teacher)] text-[11px] font-bold text-white">
                      {(teacher.name || teacher.email)[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[var(--ink)]">{teacher.name ?? "—"}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{teacher.email}</span>
                    </span>
                    <span className="badge badge-info">{t.roleTeacherLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={onCreateTeacher} className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4">
            <p className="label">{t.settingsTeacherCreate}</p>
            <div className="space-y-3">
              <input
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="input"
                placeholder={t.settingsTeacherName}
                aria-label={t.settingsTeacherName}
              />
              <input
                required
                type="email"
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                className="input"
                placeholder={t.settingsTeacherEmail}
                aria-label={t.settingsTeacherEmail}
              />
              <button type="submit" disabled={creatingTeacher} className="btn btn-secondary w-full">
                {creatingTeacher ? <Icon.Loader size={16} /> : <Icon.Plus size={16} />}
                {t.settingsTeacherCreate}
              </button>
            </div>
          </form>
        </div>
      </SettingsSection>
    </div>
  );
}
