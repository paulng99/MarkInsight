import assert from "node:assert/strict";
import test from "node:test";
import { EXAM_UPLOAD_FILE_TYPE_MESSAGE, isAllowedExamUpload } from "./exam-upload.ts";

test("accepts PDF, JPG, and PNG by extension and MIME", () => {
  assert.equal(isAllowedExamUpload("paper.pdf", "application/pdf"), true);
  assert.equal(isAllowedExamUpload("page.JPG", "image/jpeg"), true);
  assert.equal(isAllowedExamUpload("scan.jpeg", "image/jpeg"), true);
  assert.equal(isAllowedExamUpload("photo.png", "image/png"), true);
  assert.equal(isAllowedExamUpload("photo.png", "application/octet-stream"), true);
  assert.equal(isAllowedExamUpload("photo.png", ""), true);
});

test("rejects docx, txt, HEIC, and MIME/extension mismatches", () => {
  assert.equal(
    isAllowedExamUpload(
      "notes.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    false,
  );
  assert.equal(isAllowedExamUpload("notes.txt", "text/plain"), false);
  assert.equal(isAllowedExamUpload("photo.heic", "image/heic"), false);
  assert.equal(isAllowedExamUpload("photo.heif", "image/heif"), false);
  assert.equal(isAllowedExamUpload("photo.png", "image/heic"), false);
  assert.equal(isAllowedExamUpload("photo.webp", "image/webp"), false);
  assert.equal(isAllowedExamUpload("paper.pdf", "text/plain"), false);
  assert.match(EXAM_UPLOAD_FILE_TYPE_MESSAGE, /PDF、JPG 或 PNG/);
});
