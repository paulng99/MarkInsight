"use client";

import { useCallback, useEffect, useState } from "react";
import { ArchivedSubjectCard } from "@/components/teacher/archive-controls";
import { Alert, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type ArchivedSubject = {
  subjectCode: string;
  archivedAt: string;
  classes: Array<{ id: string; name: string; individuallyArchived: boolean }>;
};

export function TeacherArchive({ t }: { locale: Locale; t: Dictionary }) {
  const [subjects, setSubjects] = useState<ArchivedSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/archive");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.archiveActionError);
        setSubjects([]);
        return;
      }
      setSubjects(data.subjects ?? []);
    } catch {
      setError(t.archiveActionError);
      setSubjects([]);
    }
  }, [t.archiveActionError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!subjects) return <LoadingBlock label={t.settingsLoading} className="mt-8" />;

  const success =
    notice === t.restoreSubjectDone ||
    notice === t.deleteSubjectDone ||
    notice === t.restoreClassDone ||
    notice === t.deleteClassDone;

  return (
    <div className="mt-8 space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone={success ? "success" : "error"}>{notice}</Alert> : null}
      {subjects.length === 0 ? (
        <EmptyState icon={<Icon.Archive size={22} />} title={t.archiveEmpty} description={t.archiveIntro} />
      ) : (
        subjects.map((subject) => (
          <ArchivedSubjectCard
            key={subject.subjectCode}
            subject={subject}
            t={t}
            onDone={(message) => {
              setNotice(message);
              void load();
            }}
            onError={(message) => setNotice(message)}
          />
        ))
      )}
    </div>
  );
}
