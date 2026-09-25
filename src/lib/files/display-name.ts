/** Human file titles. Storage keys stay unchanged. */

export function uploadExtension(
  originalName: string | null | undefined,
  mimeType: string | null | undefined,
): string {
  const fromName = (originalName ?? "").match(/(\.[a-z0-9]{1,8})$/i);
  if (fromName?.[1]) return fromName[1].toLowerCase();
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "text/plain") return ".txt";
  return "";
}

function withSequence(label: string, index: number): string {
  return index > 1 ? `${label}-${index}` : label;
}

function fileTitlePart(raw: string): string {
  return raw.replace(/[\\/]+/g, " ").replace(/\s+/g, " ").trim();
}

export function examAssetTitle(input: {
  examDate: string;
  subjectCode: string;
  className: string;
  examTitle: string;
  kindLabel: string;
  index: number;
  extension: string;
}): string {
  const examTitle = fileTitlePart(input.examTitle);
  const head = [input.examDate, input.subjectCode, input.className, examTitle]
    .filter(Boolean)
    .join(" ");
  return `${head} ${withSequence(input.kindLabel, input.index)}${input.extension}`;
}

export function scriptAssetTitle(input: {
  examDate: string;
  className: string;
  examTitle: string;
  studentName: string;
  index: number;
  extension: string;
}): string {
  const examTitle = fileTitlePart(input.examTitle);
  const head = [input.examDate, input.className, examTitle].filter(Boolean).join(" ");
  return `${head} ${withSequence(input.studentName, input.index)}${input.extension}`;
}

export function syllabusAssetTitle(
  subjectCode: string,
  label: string,
  extension: string,
): string {
  return `${subjectCode} ${label}${extension}`;
}
