import assert from "node:assert/strict";
import test from "node:test";
import { usageFailureReason } from "./usage-failure-reason.ts";

test("failed jobs keep the stored reason for the usage table", () => {
  assert.equal(
    usageFailureReason("FAILED", "Exam structure analysis has not completed yet."),
    "Exam structure analysis has not completed yet.",
  );
  assert.equal(
    usageFailureReason("FAILED", "Exam structure analysis has not completed yet.", "zh-HK"),
    "試卷結構分析尚未完成，因此未能評分。",
  );
  assert.equal(
    usageFailureReason("FAILED", "老師尚未完成試卷設定，暫時無法分析，請稍後再試。", "zh-HK"),
    "老師尚未完成試卷設定，暫時無法分析，請稍後再試。",
  );
  assert.equal(usageFailureReason("FAILED", "  "), null);
  assert.equal(usageFailureReason("FAILED", null), null);
});

test("successful jobs do not surface an error message", () => {
  assert.equal(usageFailureReason("SUCCEEDED", "leftover"), null);
  assert.equal(usageFailureReason("RUNNING", "leftover"), null);
  assert.equal(usageFailureReason("PENDING", null), null);
});
