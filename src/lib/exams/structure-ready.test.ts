import assert from "node:assert/strict";
import test from "node:test";
import { isExamStructureReady } from "./structure-ready.ts";

test("student upload stays blocked until structure analysis is ready", () => {
  assert.equal(isExamStructureReady({ structureLlmModel: null, questionCount: 0 }), false);
  assert.equal(isExamStructureReady({ structureLlmModel: "", questionCount: 0 }), false);
  assert.equal(isExamStructureReady({ structureLlmModel: "model/a", questionCount: 0 }), true);
  assert.equal(isExamStructureReady({ structureLlmModel: null, questionCount: 3 }), true);
});
