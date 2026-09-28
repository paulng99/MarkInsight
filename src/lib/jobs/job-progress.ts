import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { AnalysisProgress } from "@/lib/jobs/progress-types";

const chains = new Map<string, Promise<void>>();

function progressPath(jobId: string): string {
  return path.join(process.cwd(), ".data", "job-progress", `${jobId}.json`);
}

async function writeJobProgress(jobId: string, snapshot: AnalysisProgress): Promise<void> {
  const dir = path.join(process.cwd(), ".data", "job-progress");
  await mkdir(dir, { recursive: true });
  const target = progressPath(jobId);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot), "utf8");
  await rename(tmp, target);
}

/** Serialize writes per job so a slow disk doesn't reorder live updates. */
export function saveJobProgress(jobId: string, snapshot: AnalysisProgress): Promise<void> {
  const prev = chains.get(jobId) ?? Promise.resolve();
  const next = prev.then(
    () => writeJobProgress(jobId, snapshot),
    () => writeJobProgress(jobId, snapshot),
  );
  chains.set(jobId, next);
  return next;
}

export async function readJobProgress(jobId: string): Promise<AnalysisProgress | null> {
  try {
    const raw = await readFile(progressPath(jobId), "utf8");
    const parsed = JSON.parse(raw) as Partial<AnalysisProgress>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.questions)) return null;
    return {
      stage: parsed.stage ?? "reading",
      completed: Number(parsed.completed) || 0,
      total: Number(parsed.total) || 0,
      questionKey: parsed.questionKey ?? null,
      partKeys: Array.isArray(parsed.partKeys) ? parsed.partKeys.map(String) : [],
      note: typeof parsed.note === "string" ? parsed.note : null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      startedAt: parsed.startedAt || parsed.updatedAt || new Date().toISOString(),
      log: Array.isArray(parsed.log) ? parsed.log : [],
      questions: parsed.questions,
    };
  } catch {
    return null;
  }
}
