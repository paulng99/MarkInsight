import assert from "node:assert/strict";
import test from "node:test";
import { formatArchiveDate, isClassInactive } from "./archive-state.ts";

test("a class is inactive when either archive timestamp is set", () => {
  const now = new Date("2026-09-27T02:00:00.000Z");
  assert.equal(isClassInactive({ classArchivedAt: null, subjectArchivedAt: null }), false);
  assert.equal(isClassInactive({ classArchivedAt: now, subjectArchivedAt: null }), true);
  assert.equal(isClassInactive({ classArchivedAt: null, subjectArchivedAt: now }), true);
});

test("archive dates render as yyyy-mm-dd in Hong Kong", () => {
  assert.equal(formatArchiveDate(new Date("2026-09-26T16:30:00.000Z")), "2026-09-27");
  assert.equal(formatArchiveDate(new Date("2026-09-27T15:59:00.000Z")), "2026-09-27");
});
