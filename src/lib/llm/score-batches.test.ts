import assert from "node:assert/strict";
import test from "node:test";
import { batchQuestionsByParent } from "./score-batches.ts";

test("batchQuestionsByParent keeps each numbered question together", () => {
  const batches = batchQuestionsByParent([
    { questionKey: "1(a(i))", parentKey: "1" },
    { questionKey: "1(b(ii))", parentKey: "1" },
    { questionKey: "2(a)", parentKey: "2" },
    { questionKey: "10(c)", parentKey: "10" },
  ]);

  assert.deepEqual(
    batches.map((batch) => [batch.parentKey, batch.questions.map((row) => row.questionKey)]),
    [
      ["1", ["1(a(i))", "1(b(ii))"]],
      ["2", ["2(a)"]],
      ["10", ["10(c)"]],
    ],
  );
});

test("batchQuestionsByParent uses questionKey when parentKey is blank", () => {
  const batches = batchQuestionsByParent([{ questionKey: "3", parentKey: "  " }]);
  assert.equal(batches.length, 1);
  assert.equal(batches[0]?.parentKey, "3");
});
