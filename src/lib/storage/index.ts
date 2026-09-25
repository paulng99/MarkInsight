/**
 * Object storage adapter — local filesystem for MVP.
 * STORAGE_PROVIDER=local writes under STORAGE_LOCAL_DIR (default .data/uploads).
 */

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { AppError } from "@/lib/errors";

export type StoredObject = {
  storageKey: string;
  mimeType: string;
  originalName: string;
  byteLength: number;
};

/** Default 100MB — scanned multi-page exam PDFs often exceed the old 25MB soft cap. */
const DEFAULT_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

export function uploadMaxBytes(): number {
  const raw = process.env.UPLOAD_MAX_BYTES?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return DEFAULT_UPLOAD_MAX_BYTES;
}

function localRoot(): string {
  const fromEnv = process.env.STORAGE_LOCAL_DIR?.trim();
  if (fromEnv) {
    return path.resolve(/*turbopackIgnore: true*/ fromEnv);
  }
  // Statically scoped under .data so Turbopack does not trace the whole project.
  return path.join(process.cwd(), ".data", "uploads");
}

function assertSafeRelativeKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    path.isAbsolute(normalized)
  ) {
    throw new AppError("Invalid storage key", 400, "invalid_storage_key");
  }
  return normalized;
}

/** Stable path tokens. UI keeps the original upload name separately. */
const KIND_TOKEN: Record<string, string> = {
  QUESTION_PAPER: "paper",
  ANSWER_KEY: "key",
  STUDENT_SCRIPT: "script",
  SYLLABUS: "syllabus",
  OTHER: "other",
};

/** Letters, digits, hyphen, underscore. Spaces become hyphens. */
export function slugSegment(raw: string, fallback: string): string {
  const slug = raw
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 48);
  if (!slug || slug === "." || slug === "..") return fallback;
  return slug;
}

function safeExtension(fileName: string): string {
  const ext = path.extname(fileName || "").toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

/** Upload calendar date in Hong Kong, yyyy-mm-dd. */
export function formatUploadDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function buildStorageKey(input: {
  schoolId: string;
  schoolYear: string;
  subjectCode: string;
  className?: string;
  examDate?: string;
  examTitle?: string;
  studentName?: string;
  kind: string;
  fileName: string;
  uploadedOn: string;
  hash: string;
}): string {
  const token = KIND_TOKEN[input.kind] ?? "other";
  const school = slugSegment(input.schoolId, "school");
  const year = slugSegment(input.schoolYear, "year");
  const subject = slugSegment(input.subjectCode, "subject");
  const ext = safeExtension(input.fileName);
  const stamp = `${input.uploadedOn}_${input.hash}`;

  if (token === "syllabus") {
    return `${school}/${year}/${subject}/syllabus/syllabus_${stamp}${ext}`;
  }

  const examDate = input.examDate ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    throw new AppError("Invalid exam date", 400, "invalid_exam_date");
  }
  const className = slugSegment(input.className ?? "", "class");
  const examFolder = `${examDate}_${slugSegment(input.examTitle ?? "", "exam")}`;
  const base = `${school}/${year}/${subject}/${className}/${examFolder}`;

  if (token === "script") {
    const student = slugSegment(input.studentName ?? "", "student");
    return `${base}/scripts/${student}_${stamp}${ext}`;
  }
  return `${base}/${token}_${stamp}${ext}`;
}

export async function putObject(input: {
  schoolId: string;
  schoolYear: string;
  subjectCode: string;
  className?: string;
  examDate?: string;
  examTitle?: string;
  studentName?: string;
  kind: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<StoredObject> {
  if (!input.bytes.length) {
    throw new AppError("請檢查檔案 — empty upload", 400, "empty_upload");
  }
  const maxBytes = uploadMaxBytes();
  if (input.bytes.length > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new AppError(
      `請檢查檔案 — file too large (max ${maxMb}MB)`,
      400,
      "file_too_large",
    );
  }

  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
  if (provider !== "local") {
    // S3/R2 not wired in this knife — fail cleanly without vendor noise.
    throw new AppError(
      "File storage is not available. Please contact your administrator.",
      503,
      "storage_unavailable",
    );
  }

  const hash = createHash("sha256")
    .update(input.bytes.subarray(0, Math.min(input.bytes.length, 64_000)))
    .digest("hex")
    .slice(0, 6);
  const storageKey = assertSafeRelativeKey(
    buildStorageKey({
      schoolId: input.schoolId,
      schoolYear: input.schoolYear,
      subjectCode: input.subjectCode,
      className: input.className,
      examDate: input.examDate,
      examTitle: input.examTitle,
      studentName: input.studentName,
      kind: input.kind,
      fileName: input.fileName,
      uploadedOn: formatUploadDate(),
      hash,
    }),
  );

  const abs = path.join(/*turbopackIgnore: true*/ localRoot(), storageKey);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(abs), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ abs, input.bytes);

  return {
    storageKey,
    mimeType: input.mimeType || "application/octet-stream",
    originalName: input.fileName || "upload",
    byteLength: input.bytes.length,
  };
}

export async function getObjectBytes(storageKey: string): Promise<Buffer> {
  const key = assertSafeRelativeKey(storageKey);
  const abs = path.join(/*turbopackIgnore: true*/ localRoot(), key);
  try {
    return await readFile(/*turbopackIgnore: true*/ abs);
  } catch {
    throw new AppError("請檢查檔案 — file not found", 404, "file_not_found");
  }
}

/** Data URL for multimodal LLM (images/PDF as base64). */
export async function toDataUrl(
  storageKey: string,
  mimeType?: string | null,
): Promise<string> {
  const bytes = await getObjectBytes(storageKey);
  const mime = mimeType || "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime && mime.startsWith("image/"));
}

export function isPdfMime(mime: string | null | undefined): boolean {
  return mime === "application/pdf";
}
