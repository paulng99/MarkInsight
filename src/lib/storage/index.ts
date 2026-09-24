/**
 * Object storage adapter — local filesystem for MVP.
 * STORAGE_PROVIDER=local writes under STORAGE_LOCAL_DIR (default .data/uploads).
 */

import { createHash, randomUUID } from "crypto";
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

export async function putObject(input: {
  schoolId: string;
  examId: string;
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

  const ext = path.extname(input.fileName || "").slice(0, 16);
  const hash = createHash("sha256")
    .update(input.bytes.subarray(0, Math.min(input.bytes.length, 64_000)))
    .digest("hex")
    .slice(0, 12);
  const storageKey = assertSafeRelativeKey(
    `${input.schoolId}/${input.examId}/${input.kind}/${Date.now()}_${hash}_${randomUUID().slice(0, 8)}${ext}`,
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
