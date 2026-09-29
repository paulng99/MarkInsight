/**
 * Magic-byte (file-header) sniff for exam / submission uploads.
 * Detected kind must match the declared extension (and MIME when present).
 */

import path from "node:path";

export type ExamUploadSniffKind = "pdf" | "jpeg" | "png";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(bytes: Uint8Array, magic: Uint8Array): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

/** Read the file header and return pdf / jpeg / png, or null if unrecognized. */
export function sniffExamUploadKind(bytes: Uint8Array): ExamUploadSniffKind | null {
  if (startsWith(bytes, PDF_MAGIC)) return "pdf";
  if (startsWith(bytes, JPEG_MAGIC)) return "jpeg";
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  return null;
}

/** Expected sniff kind from extension (and MIME when it clearly identifies a type). */
export function expectedExamUploadKind(
  fileName: string,
  mimeType: string,
): ExamUploadSniffKind | null {
  const ext = path.extname(fileName || "").toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".png") return "png";

  const mime = (mimeType || "").toLowerCase().trim();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/png") return "png";
  return null;
}

/**
 * True when the file header matches the kind implied by extension/MIME.
 * Empty or truncated headers fail.
 */
export function isExamUploadMagicConsistent(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  const expected = expectedExamUploadKind(fileName, mimeType);
  if (!expected) return false;
  const sniffed = sniffExamUploadKind(bytes);
  if (!sniffed) return false;
  return sniffed === expected;
}
