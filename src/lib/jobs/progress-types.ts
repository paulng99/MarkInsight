import type { FlatStructureQuestion } from "@/lib/exams/structure-questions";

export type AnalysisProgressStage = "reading" | "receiving" | "question" | "saving";

export type AnalysisProgressLogEntry = {
  at: string;
  questionKey: string | null;
  partKeys: string[];
  note: string;
  completed: number;
  total: number;
};

/** Live structure-analysis snapshot polled by the exam page. */
export type AnalysisProgress = {
  stage: AnalysisProgressStage;
  completed: number;
  total: number;
  questionKey: string | null;
  partKeys: string[];
  note: string | null;
  updatedAt: string;
  startedAt: string;
  log: AnalysisProgressLogEntry[];
  questions: FlatStructureQuestion[];
};

export function emptyAnalysisProgress(startedAt = new Date().toISOString()): AnalysisProgress {
  return {
    stage: "reading",
    completed: 0,
    total: 0,
    questionKey: null,
    partKeys: [],
    note: null,
    updatedAt: startedAt,
    startedAt,
    log: [],
    questions: [],
  };
}
