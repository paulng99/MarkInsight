import assert from "node:assert/strict";
import test from "node:test";
import {
  applySyllabusLabels,
  dedupePartRows,
  selectSyllabusText,
  digestStructureBuffer,
  flattenRawQuestion,
  groupStructureQuestions,
  mergeParentRows,
  parentsMissingParts,
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

test("applies syllabus labels without changing the question wording", () => {
  const rows = flattenRawQuestion({
    questionKey: "1",
    stem: "題幹",
    itemType: "calculation",
    questionCategory: "應用",
    parts: [{ partKey: "a", prompt: "估算功率", maxScore: 3 }],
  });
  const next = applySyllabusLabels(rows, [
    { questionKey: "1(a)", itemType: "結構題", questionCategory: "應用知識解釋現象及解題", topic: "Heat and Gases" },
  ]);
  assert.equal(next[0].prompt, "估算功率");
  assert.equal(next[0].itemType, "結構題");
  assert.equal(next[0].questionCategory, "應用知識解釋現象及解題");
  assert.equal(next[0].topic, "Heat and Gases");
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
