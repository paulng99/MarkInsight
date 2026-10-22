import assert from "node:assert/strict";
import test from "node:test";
import { groupedMarkRatios } from "./score-groups.ts";

test("groupedMarkRatios weights marks and keeps first-seen order", () => {
  const groups = groupedMarkRatios([
    { key: "實驗", score: 1, maxScore: 2 },
    { key: "應用", score: 3, maxScore: 4 },
    { key: "實驗", score: 2, maxScore: 2 },
    { key: "  ", score: 0, maxScore: 1 },
  ]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.ratio]),
    [
      ["實驗", 0.75],
      ["應用", 0.75],
      ["—", 0],
    ],
  );
});
