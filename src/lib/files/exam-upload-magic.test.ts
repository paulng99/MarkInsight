import assert from "node:assert/strict";
import test from "node:test";
import {
  isExamUploadMagicConsistent,
  sniffExamUploadKind,
} from "./exam-upload-magic.ts";

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

test("sniffs valid PDF, JPEG, and PNG headers", () => {
  assert.equal(sniffExamUploadKind(PDF_HEADER), "pdf");
  assert.equal(sniffExamUploadKind(JPEG_HEADER), "jpeg");
  assert.equal(sniffExamUploadKind(PNG_HEADER), "png");
});

test("accepts valid PDF / JPG / PNG when magic matches extension", () => {
  assert.equal(
    isExamUploadMagicConsistent("paper.pdf", "application/pdf", PDF_HEADER),
    true,
  );
  assert.equal(
    isExamUploadMagicConsistent("scan.jpg", "image/jpeg", JPEG_HEADER),
    true,
  );
  assert.equal(
    isExamUploadMagicConsistent("photo.PNG", "image/png", PNG_HEADER),
    true,
  );
});

test("rejects a text file renamed as .png", () => {
  const textAsPng = new TextEncoder().encode("hello world, not a png");
  assert.equal(sniffExamUploadKind(textAsPng), null);
  assert.equal(
    isExamUploadMagicConsistent("fake.png", "image/png", textAsPng),
    false,
  );
});

test("rejects a PNG renamed as .pdf", () => {
  assert.equal(sniffExamUploadKind(PNG_HEADER), "png");
  assert.equal(
    isExamUploadMagicConsistent("renamed.pdf", "application/pdf", PNG_HEADER),
    false,
  );
});

test("rejects empty file", () => {
  const empty = new Uint8Array(0);
  assert.equal(sniffExamUploadKind(empty), null);
  assert.equal(
    isExamUploadMagicConsistent("empty.pdf", "application/pdf", empty),
    false,
  );
});

test("rejects truncated header", () => {
  const truncatedPdf = new Uint8Array([0x25, 0x50, 0x44]); // %PD
  const truncatedPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // incomplete PNG
  const truncatedJpeg = new Uint8Array([0xff, 0xd8]); // incomplete JPEG
  assert.equal(sniffExamUploadKind(truncatedPdf), null);
  assert.equal(sniffExamUploadKind(truncatedPng), null);
  assert.equal(sniffExamUploadKind(truncatedJpeg), null);
  assert.equal(
    isExamUploadMagicConsistent("short.pdf", "application/pdf", truncatedPdf),
    false,
  );
});
