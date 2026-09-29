import assert from "node:assert/strict";
import test from "node:test";
import {
  STRUCTURE_NOT_READY_MESSAGE,
  isExamStructureReady,
} from "./structure-ready.ts";

test("student upload stays blocked until structure analysis is ready", () => {
  assert.equal(isExamStructureReady({ structureLlmModel: null, questionCount: 0 }), false);
  assert.equal(isExamStructureReady({ structureLlmModel: "", questionCount: 0 }), false);
  assert.equal(isExamStructureReady({ structureLlmModel: "model/a", questionCount: 0 }), true);
  assert.equal(isExamStructureReady({ structureLlmModel: null, questionCount: 3 }), true);
});

test("structure-not-ready copy asks students to notify the teacher if blocked for long", () => {
  assert.equal(
    STRUCTURE_NOT_READY_MESSAGE,
    "老師尚未完成試卷設定，暫時無法上載，請稍後再試。若長時間仍無法上載，請通知老師。",
  );
});
