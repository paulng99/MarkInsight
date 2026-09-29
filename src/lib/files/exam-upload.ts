/**
 * Exam paper / answer-script uploads: PDF, JPG, PNG only.
 * Rejects HEIC/HEIF and office/text types at the server boundary.
 */

import path from "node:path";

export const EXAM_UPLOAD_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

export const EXAM_UPLOAD_FILE_TYPE_MESSAGE = "只接受 PDF、JPG 或 PNG 檔案。";

const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** True when extension or MIME clearly identifies HEIC/HEIF. */
export function isHeicUpload(fileName: string, mimeType: string): boolean {
  const ext = path.extname(fileName || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase().trim();
  return (
    ext === ".heic" ||
    ext === ".heif" ||
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime.includes("heic") ||
    mime.includes("heif")
  );
}

/** Pure check used by unit tests and upload APIs. */
export function isAllowedExamUpload(fileName: string, mimeType: string): boolean {
  if (isHeicUpload(fileName, mimeType)) return false;
  const ext = path.extname(fileName || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase().trim();
  if (!ALLOWED_EXT.has(ext)) return false;
  if (!mime || mime === "application/octet-stream") return true;
  return ALLOWED_MIME.has(mime);
}
