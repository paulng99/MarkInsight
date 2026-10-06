/**
 * Teacher permanent-delete typed confirmation (server helpers).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_DELETE_REJECTED_CODE,
  evaluateDeleteConfirmation,
  matchesDeleteConfirmText,
} from "../admin/delete-confirm.ts";

test("teacher class delete requires exact class name", () => {
  const ok = evaluateDeleteConfirmation({
    confirm: "3A",
    expectedToken: "3A",
    hasProtectedData: true,
    requireConfirm: true,
  });
  assert.deepEqual(ok, { ok: true });

  const missing = evaluateDeleteConfirmation({
    confirm: undefined,
    expectedToken: "3A",
    hasProtectedData: true,
    requireConfirm: true,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.status, 400);
    assert.equal(missing.code, ADMIN_DELETE_REJECTED_CODE);
  }

  const wrong = evaluateDeleteConfirmation({
    confirm: "3B",
    expectedToken: "3A",
    hasProtectedData: true,
    requireConfirm: true,
  });
  assert.equal(wrong.ok, false);
});

test("teacher subject delete requires exact subject code", () => {
  assert.equal(matchesDeleteConfirmText("MATH", "MATH"), true);
  assert.equal(matchesDeleteConfirmText("math", "MATH"), false);
  const wrong = evaluateDeleteConfirmation({
    confirm: "ENG",
    expectedToken: "MATH",
    hasProtectedData: true,
    requireConfirm: true,
  });
  assert.equal(wrong.ok, false);
});
