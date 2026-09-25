"use client";

import { useCallback, useEffect, useState } from "react";
import { ClassRoster } from "@/components/teacher/class-roster";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type ClassGroup = { id: string; name: string };
type SubjectGroup = { subjectCode: string; classes: ClassGroup[] };

export function TeacherClasses({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [subjects, setSubjects] = useState<SubjectGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.examsError);
        setSubjects([]);
        return;
      }
      setSubjects(data.subjects ?? []);
    } catch {
      setError(t.examsError);
      setSubjects([]);
    }
  }, [t.examsError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!subjects) return <LoadingBlock label={t.settingsLoading} className="mt-8" />;

  const classes = subjects.flatMap((subject) =>
    subject.classes.map((cls) => ({ ...cls, subjectCode: subject.subjectCode })),
  );

  return (
    <div className="mt-8 space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {classes.length === 0 ? (
        <EmptyState title={t.rosterEmpty} />
      ) : (
        classes.map((cls) => (
          <section key={cls.id} className="card card-pad">
            <div className="flex items-center gap-3">
              <span className="icon-tile">
                <Icon.Users size={18} />
              </span>
              <div>
                <p className="eyebrow">{cls.subjectCode}</p>
                <h2 className="text-lg font-bold text-[var(--ink)]">
                  {t.classGroup} {cls.name}
                </h2>
              </div>
            </div>
            <ClassRoster
              classSubjectId={cls.id}
              className={cls.name}
              t={t}
              locale={locale}
              initialOpen
            />
          </section>
        ))
      )}
    </div>
  );
}
