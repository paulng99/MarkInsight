import { getObjectBytes, isPdfMime } from "@/lib/storage";
import { deflateSync } from "node:zlib";

export type ScanPage = {
  fileName: string;
  role: "paper" | "scheme";
  page: number;
  pageCount: number;
  dataUrl: string;
};

const MAX_EDGE = 1280;

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    const row = y * width * 3;
    raw.set(rgb.subarray(row, row + width * 3), offset);
    offset += width * 3;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function rotateRgb(
  rgb: Uint8Array,
  width: number,
  height: number,
  degrees: number,
): { rgb: Uint8Array; width: number; height: number } {
  const turns = ((degrees % 360) + 360) % 360;
  if (turns === 0) return { rgb, width, height };
  const out = new Uint8Array(width * height * 3);
  if (turns === 180) {
    const pixels = width * height;
    for (let i = 0; i < pixels; i++) {
      const s = i * 3;
      const d = (pixels - 1 - i) * 3;
      out[d] = rgb[s];
      out[d + 1] = rgb[s + 1];
      out[d + 2] = rgb[s + 2];
    }
    return { rgb: out, width, height };
  }
  const swap = turns === 90 || turns === 270;
  const destW = swap ? height : width;
  const destH = swap ? width : height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3;
      let dx = x;
      let dy = y;
      if (turns === 90) {
        dx = height - 1 - y;
        dy = x;
      } else if (turns === 270) {
        dx = y;
        dy = width - 1 - x;
      }
      const d = (dy * destW + dx) * 3;
      out[d] = rgb[s];
      out[d + 1] = rgb[s + 1];
      out[d + 2] = rgb[s + 2];
    }
  }
  return { rgb: out, width: destW, height: destH };
}

export function fitRgb(
  rgb: Uint8Array,
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { rgb: Uint8Array; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale >= 0.99) return { rgb, width, height };
  const destW = Math.max(1, Math.round(width * scale));
  const destH = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(destW * destH * 3);
  for (let y = 0; y < destH; y++) {
    const sy0 = Math.floor((y * height) / destH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * height) / destH));
    for (let x = 0; x < destW; x++) {
      const sx0 = Math.floor((x * width) / destW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * width) / destW));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * width + sx) * 3;
          r += rgb[i];
          g += rgb[i + 1];
          b += rgb[i + 2];
          n += 1;
        }
      }
      const d = (y * destW + x) * 3;
      out[d] = Math.round(r / n);
      out[d + 1] = Math.round(g / n);
      out[d + 2] = Math.round(b / n);
    }
  }
  return { rgb: out, width: destW, height: destH };
}

function toRgb(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  kind: number,
): Uint8Array {
  if (kind === 2) return Uint8Array.from(data);
  const rgb = new Uint8Array(width * height * 3);
  if (kind === 3) {
    for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
    return rgb;
  }
  for (let i = 0, j = 0; j < rgb.length; i += 1, j += 3) {
    rgb[j] = rgb[j + 1] = rgb[j + 2] = data[i];
  }
  return rgb;
}

function roleFromName(fileName: string): "paper" | "scheme" | null {
  if (/\b(ans|answer|answers|marking|scheme)\b/i.test(fileName)) return "scheme";
  if (/(試題|試卷|question)/i.test(fileName)) return "paper";
  return null;
}

type PdfImage = {
  width: number;
  height: number;
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
};

/**
 * Scanned or encrypted PDFs often cannot be read as files by the model.
 * Decrypt each page locally and return an upright image.
 */
export async function rasterizeScanPages(
  refs: Array<{
    kind: string;
    storageKey: string;
    mimeType?: string | null;
    fileName?: string | null;
  }>,
): Promise<ScanPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const scans: Array<{
    fileName: string;
    role: "paper" | "scheme" | null;
    pageCount: number;
    bytes: Uint8Array;
  }> = [];

  for (const ref of refs) {
    if (ref.kind === "SYLLABUS") continue;
    if (!isPdfMime(ref.mimeType) && !ref.storageKey.toLowerCase().endsWith(".pdf")) continue;
    const bytes = await getObjectBytes(ref.storageKey);
    const doc = await pdfjs
      .getDocument({
        data: new Uint8Array(bytes),
        password: "",
        disableWorker: true,
        isEvalSupported: false,
        verbosity: 0,
      } as Parameters<typeof pdfjs.getDocument>[0])
      .promise;

    let textChars = 0;
    const pageCount = doc.numPages;
    const sample = Math.min(pageCount, 2);
    for (let n = 1; n <= sample; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      textChars += content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim().length;
    }
    if (textChars / sample > 80) continue;

    const fileName = ref.fileName?.trim() || ref.storageKey.split("/").pop() || "paper.pdf";
    scans.push({
      fileName,
      role: roleFromName(fileName),
      pageCount,
      bytes: new Uint8Array(bytes),
    });
  }

  if (scans.length === 0) return [];
  const namedPaper = scans.some((doc) => doc.role === "paper");
  const namedScheme = scans.some((doc) => doc.role === "scheme");
  if (!namedPaper || !namedScheme) {
    const paperDoc = scans.reduce((best, doc) => (doc.pageCount > best.pageCount ? doc : best));
    for (const doc of scans) doc.role = doc === paperDoc ? "paper" : "scheme";
  }

  const pages: ScanPage[] = [];
  for (const scan of scans) {
    if (scan.role !== "paper") continue;
    const doc = await pdfjs
      .getDocument({
        data: scan.bytes,
        password: "",
        disableWorker: true,
        isEvalSupported: false,
        verbosity: 0,
      } as Parameters<typeof pdfjs.getDocument>[0])
      .promise;
    for (let n = 1; n <= scan.pageCount; n++) {
      const page = await doc.getPage(n);
      const ops = await page.getOperatorList();
      let best: PdfImage | null = null;
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
        const name = String(ops.argsArray[i]?.[0] ?? "");
        if (!name) continue;
        const img = await new Promise<PdfImage | null>((resolve) => {
          page.objs.get(name, (value: PdfImage | null) => resolve(value));
        });
        if (!img?.width || !img.height || !img.data) continue;
        if (!best || img.width * img.height > best.width * best.height) best = img;
      }
      if (!best) continue;
      const upright = rotateRgb(
        toRgb(best.data, best.width, best.height, best.kind),
        best.width,
        best.height,
        page.rotate || 0,
      );
      const fitted = fitRgb(upright.rgb, upright.width, upright.height);
      const png = encodePng(fitted.rgb, fitted.width, fitted.height);
      pages.push({
        fileName: scan.fileName,
        role: "paper",
        page: n,
        pageCount: scan.pageCount,
        dataUrl: `data:image/png;base64,${png.toString("base64")}`,
      });
    }
  }

  return pages;
}
