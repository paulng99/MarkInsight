import assert from "node:assert/strict";
import test from "node:test";
import { formatUploadedMarkingBlock, parseMarkingGuidePayload } from "./marking-scheme.ts";

test("parseMarkingGuidePayload keeps only items that have a mark scheme", () => {
  const guides = parseMarkingGuidePayload({
    items: [
      {
        questionKey: "1(a(i))",
        modelAnswer: "0.42 kg",
        markingCriteria: "1 mark for the heat equation. 1 mark for substitution. 1 mark for the answer.",
      },
      { questionKey: "1(a(ii))", answer: "conduction", marks: "" },
    ],
  });
  assert.equal(guides.length, 1);
  assert.equal(guides[0]?.questionKey, "1(a(i))");
  assert.match(guides[0]?.markingCriteria ?? "", /heat equation/);
});

test("formatUploadedMarkingBlock quotes the uploaded question, answer, and criteria", () => {
  const block = formatUploadedMarkingBlock({
    questionKey: "2(a)",
    stem: "A balloon contains helium.",
    prompt: "Find the amount of helium.",
    maxScore: 2,
    modelAnswer: "21.7 mol",
    markingCriteria: "1 mark for pV = nRT. 1 mark for 21.7 mol.",
  });
  assert.ok(block);
  assert.match(block, /Uploaded question/);
  assert.match(block, /Find the amount of helium/);
  assert.match(block, /Official answer from the uploaded answer key/);
  assert.match(block, /21\.7 mol/);
  assert.match(block, /Marking criteria from the uploaded answer key/);
  assert.match(block, /pV = nRT/);
});

test("formatUploadedMarkingBlock refuses a question with no uploaded criteria", () => {
  assert.equal(
    formatUploadedMarkingBlock({
      questionKey: "3(a)",
      stem: "stem",
      prompt: "prompt",
      maxScore: 4,
      modelAnswer: "9.8",
      markingCriteria: "  ",
    }),
    null,
  );
});
