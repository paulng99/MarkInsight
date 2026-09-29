import { selectSyllabusText } from "@/lib/exams/structure-questions";
import { getObjectBytes, isPdfMime } from "@/lib/storage";

const MAX_CHARS = 20_000;

export async function readSyllabusExcerpt(
  refs: Array<{ kind: string; storageKey: string; mimeType?: string | null }>,
  hints: string[] = [],
): Promise<string> {
  const syllabus = refs.find((ref) => ref.kind === "SYLLABUS");
  if (!syllabus) return "";
  const bytes = await getObjectBytes(syllabus.storageKey);
  if ((syllabus.mimeType || "").startsWith("text/")) {
    return bytes.toString("utf8").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  }
  if (!isPdfMime(syllabus.mimeType) && !syllabus.storageKey.toLowerCase().endsWith(".pdf")) {
    return "";
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(bytes),
      password: "",
      disableWorker: true,
      isEvalSupported: false,
      verbosity: 0,
    } as Parameters<typeof pdfjs.getDocument>[0])
    .promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return selectSyllabusText(pages, 36_000, hints);
}
