import assert from "node:assert/strict";
import test from "node:test";
import {
  applySyllabusLabels,
  dedupePartRows,
  selectSyllabusText,
  digestStructureBuffer,
  flattenRawQuestion,
  formatMarkAllocation,
  groupStructureQuestions,
  limitToMarkAllocation,
  mergeParentRows,
  parentsMissingParts,
  questionsOffMarkAllocation,
  readMarkAllocation,
  scanBatchInstruction,
  scanPageSystemPrompt,
} from "./structure-questions.ts";

test("streams numbered questions and keeps every part", () => {
  const first =
    '{"total":2,"questions":[{"questionKey":"1","workingNote":"核對分題","stem":"題幹一","parts":[{"partKey":"a","prompt":"甲部全文","maxScore":2},{"partKey":"b","prompt":"乙部全文","maxScore":3}]}';
  const second =
    ',{"questionKey":"2","workingNote":"第二題沒有分題","stem":"題幹二","parts":[{"partKey":"","prompt":"題幹二全文","maxScore":4}]}]}';

  const partial = digestStructureBuffer(first.slice(0, 48), 0);
  assert.equal(partial.fresh.length, 0);

  const mid = digestStructureBuffer(first, 0);
  assert.equal(mid.total, 2);
  assert.equal(mid.fresh.length, 1);
  assert.deepEqual(mid.fresh[0].partKeys, ["a", "b"]);
  assert.equal(mid.fresh[0].rows[0].questionKey, "1(a)");
  assert.equal(mid.fresh[0].rows[0].prompt, "甲部全文");
  assert.equal(mid.fresh[0].rows[1].prompt, "乙部全文");

  const rest = digestStructureBuffer(first + second, 1);
  assert.equal(rest.fresh.length, 1);
  assert.equal(rest.fresh[0].rows[0].questionKey, "2");

  const grouped = groupStructureQuestions([...mid.fresh[0].rows, ...rest.fresh[0].rows]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].stem, "題幹一");
  assert.equal(grouped[0].maxScore, 5);
  assert.equal(grouped[0].parts.length, 2);
  assert.equal(grouped[1].parts[0].prompt, "題幹二全文");
});

test("shows the question being checked before the object finishes", () => {
  const partial =
    '{"total":10,"questions":[{"questionKey":"3","workingNote":"正在抄第3題(a)(b)","stem":"未寫完';
  const digested = digestStructureBuffer(partial, 0);
  assert.equal(digested.total, 10);
  assert.equal(digested.fresh.length, 0);
  assert.equal(digested.draft?.questionKey, "3");
  assert.match(digested.draft?.note ?? "", /第3題/);
});

test("keeps the fuller wording when the same part is read again", () => {
  const first = flattenRawQuestion({
    questionKey: "1",
    stem: "題幹",
    parts: [{ partKey: "a", prompt: "短", maxScore: 2 }],
  });
  const again = flattenRawQuestion({
    questionKey: "1",
    stem: "題幹",
    parts: [
      { partKey: "a", prompt: "較完整的分題原文", maxScore: 3 },
      { partKey: "b", prompt: "乙部", maxScore: 2 },
    ],
  });
  const merged = mergeParentRows(first, again);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].prompt, "較完整的分題原文");
  assert.equal(merged[1].partKey, "b");
});

test("drops a repeated part when the same wording is stored twice", () => {
  const rows = [
    ...flattenRawQuestion({
      questionKey: "7",
      parts: [
        { partKey: "b(i)", prompt: "Explain why the fringe equation is not accurate here.", maxScore: 1 },
        { partKey: "i", prompt: "Explain why the fringe equation is not accurate here.", maxScore: 1 },
      ],
    }),
  ];
  const kept = dedupePartRows(rows);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].partKey, "b(i)");
});

test("stores Chinese and English syllabus labels separately", () => {
  const rows = flattenRawQuestion({
    questionKey: "1",
    stem: "題幹",
    itemType: "calculation",
    questionCategory: "應用",
    parts: [{ partKey: "a", prompt: "估算功率", maxScore: 3 }],
  });
  const next = applySyllabusLabels(rows, [
    {
      questionKey: "1(a)",
      itemTypeZh: "結構題",
      itemTypeEn: "Structured question",
      questionCategoryZh: "應用知識以解決問題",
      questionCategoryEn: "Apply knowledge to solve problems",
      topicZh: "熱和氣體",
      topicEn: "Heat and Gases",
      teachingContentZh: "理解熱、內能與比熱容，並用 Q = mcΔT 處理傳熱。",
      teachingContentEn: "Understand heat, internal energy, and specific heat capacity, and use Q = mcΔT.",
      assessmentObjectiveZh: "學生需要計算熱水器供應給自來水的功率。",
      assessmentObjectiveEn: "Students calculate the power supplied by the heater to the mains water.",
    },
  ]);
  assert.equal(next[0].prompt, "估算功率");
  assert.equal(next[0].itemTypeZh, "結構題");
  assert.equal(next[0].itemTypeEn, "Structured question");
  assert.equal(next[0].questionCategoryEn, "Apply knowledge to solve problems");
  assert.equal(next[0].topicZh, "熱和氣體");
  assert.equal(next[0].topicEn, "Heat and Gases");
  assert.match(next[0].teachingContentZh, /比熱容/);
  assert.match(next[0].teachingContentEn, /specific heat/);
  assert.match(next[0].assessmentObjectiveEn, /heater/);
});

test("keeps the learning-content pages for the question topic", () => {
  const excerpt = selectSyllabusText(
    [
      "Students should learn ideal gas and the kinetic theory of gases.",
      "Students should learn image formation by lenses.",
    ],
    5_000,
    ["Heat and Gases"],
  );
  assert.match(excerpt, /kinetic theory/);
  assert.doesNotMatch(excerpt, /lenses/);
});

test("keeps syllabus pages that name item types", () => {
  const excerpt = selectSyllabusText([
    "This preamble introduces the subject and the school year calendar for teachers.",
    "Various kinds of items, including multiple-choice questions, short questions, structured questions and essays, are used.",
  ]);
  assert.match(excerpt, /structured questions/);
  assert.doesNotMatch(excerpt, /school year calendar/);
});

test("finds questions that still have no lettered part", () => {
  const rows = [
    ...flattenRawQuestion({ questionKey: "1", stem: "只有整題", maxScore: 5 }),
    ...flattenRawQuestion({
      questionKey: "2",
      stem: "題幹",
      parts: [
        { partKey: "a", prompt: "甲", maxScore: 2 },
        { partKey: "b", prompt: "乙", maxScore: 3 },
      ],
    }),
  ];
  assert.deepEqual(parentsMissingParts(rows), ["1"]);
});

test("keeps a question even when topic is missing and groups legacy part keys", () => {
  const lone = flattenRawQuestion({ questionKey: "4", stem: "完整題目" });
  assert.equal(lone.length, 1);
  assert.equal(lone[0].prompt, "完整題目");
  assert.equal(lone[0].topic, "—");

  const rows = [
    ...flattenRawQuestion({
      questionKey: "1(a)",
      topic: "代數",
      itemType: "short",
      prompt: "A",
      maxScore: 1,
    }),
    ...flattenRawQuestion({
      questionKey: "1(b)",
      topic: "代數",
      itemType: "short",
      prompt: "B",
      maxScore: 2,
    }),
  ];
  const groups = groupStructureQuestions(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].questionKey, "1");
  assert.equal(groups[0].parts.map((part) => part.partKey).join(""), "ab");
});

test("reads the cover marks table and flags questions that do not add up", () => {
  const allocation = readMarkAllocation({
    allocation: [
      { questionKey: "1", maxScore: 5 },
      { questionKey: "Q4", marks: 11 },
      { questionKey: "9", maxScore: 12 },
      { questionKey: "cover", maxScore: 84 },
    ],
  });
  assert.deepEqual(allocation, { "1": 5, "4": 11, "9": 12 });
  assert.equal(formatMarkAllocation(allocation), "1=5, 4=11, 9=12");

  const rows = [
    ...flattenRawQuestion({
      questionKey: "1",
      parts: [
        { partKey: "a", prompt: "Estimate the power.", maxScore: 3 },
        { partKey: "b", prompt: "Find the flow rate.", maxScore: 2 },
      ],
    }),
    ...flattenRawQuestion({
      questionKey: "4",
      parts: [{ partKey: "a", prompt: "Explain the brakes on a long hill.", maxScore: 1 }],
    }),
    ...flattenRawQuestion({
      questionKey: "11",
      parts: [{ partKey: "a", prompt: "This question is not on the cover table.", maxScore: 1 }],
    }),
  ];
  assert.deepEqual(questionsOffMarkAllocation(rows, allocation), ["4", "9"]);
  const limited = limitToMarkAllocation(rows, allocation);
  assert.deepEqual(
    limited.map((row) => row.parentKey),
    ["1", "1", "4"],
  );
});

test("replaces invented parts when a later read matches the printed total", () => {
  const invented = flattenRawQuestion({
    questionKey: "4",
    parts: [
      { partKey: "a", prompt: "State the three states of matter in a long curriculum sentence.", maxScore: 1 },
      { partKey: "b", prompt: "Determine the melting point and boiling point of a substance.", maxScore: 1 },
      { partKey: "c", prompt: "Realize latent heat as energy transferred during a change of state.", maxScore: 1 },
    ],
  });
  const printed = flattenRawQuestion({
    questionKey: "4",
    parts: [
      { partKey: "a(i)", prompt: "Calculate the force.", maxScore: 3 },
      { partKey: "a(ii)", prompt: "Find the acceleration.", maxScore: 2 },
      { partKey: "b", prompt: "Explain the energy change.", maxScore: 4 },
      { partKey: "c", prompt: "State the assumption.", maxScore: 2 },
    ],
  });
  const merged = mergeParentRows(invented, printed, 11);
  assert.equal(
    merged.reduce((sum, row) => sum + row.maxScore, 0),
    11,
  );
  assert.deepEqual(
    merged.map((row) => row.partKey),
    ["a(i)", "a(ii)", "b", "c"],
  );

  const worse = flattenRawQuestion({
    questionKey: "4",
    parts: [
      {
        partKey: "a",
        prompt: "A much longer invented prompt that should not replace the printed question parts.",
        maxScore: 1,
      },
    ],
  });
  const kept = mergeParentRows(merged, worse, 11);
  assert.equal(kept.length, 4);
  assert.equal(kept[0].partKey, "a(i)");
});

test("a scanned page batch must not be told to invent the rest of the paper", () => {
  const prompt = scanPageSystemPrompt("Analyze the paper.");
  const overrideAt = prompt.lastIndexOf("Omit every question that is not visible");
  const requireAllAt = prompt.indexOf("must contain 10 objects");
  assert.ok(overrideAt > requireAllAt);
  const instruction = scanBatchInstruction(1, 4, { "1": 5, "4": 11 }, ["4"]);
  assert.match(instruction, /one of: 4/);
  assert.match(instruction, /4=11/);
  assert.match(instruction, /Do not add questions that are not on these pages/);
});
