import assert from "node:assert/strict";
import test from "node:test";
import {
  applySyllabusLabels,
  dedupePartRows,
  reconcileToMarkAllocation,
  selectSyllabusText,
  digestStructureBuffer,
  flattenRawQuestion,
  formatMarkAllocation,
  groupStructureQuestions,
  limitToMarkAllocation,
  mergeParentRows,
  missingAllocatedQuestions,
  parentsMissingParts,
  preferQuestionWording,
  questionsOffMarkAllocation,
  readMarkAllocation,
  scanBatchInstruction,
  scanPageSystemPrompt,
  usableScanQuestion,
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

test("usableScanQuestion keeps undivided questions and lettered parts", () => {
  const undividedRows = flattenRawQuestion({
    questionKey: "2",
    stem: "如圖，AB = AC，∠ABC = 50°。求 ∠BAC。",
    parts: [
      {
        partKey: "",
        prompt: "如圖，AB = AC，∠ABC = 50°。求 ∠BAC。",
        maxScore: 4,
      },
    ],
  });
  assert.equal(
    usableScanQuestion({
      questionKey: "2",
      partKeys: undividedRows.map((row) => row.partKey).filter(Boolean),
      note: "",
      rows: undividedRows,
    }),
    true,
  );

  const lettered = flattenRawQuestion({
    questionKey: "1",
    stem: "解下列方程",
    parts: [
      { partKey: "a", prompt: "求 2x + 3 = 11 的解。", maxScore: 2 },
      { partKey: "b", prompt: "把 (a) 的答案代回方程說明是否正確。", maxScore: 4 },
    ],
  });
  assert.equal(
    usableScanQuestion({
      questionKey: "1",
      partKeys: lettered.map((row) => row.partKey).filter(Boolean),
      note: "",
      rows: lettered,
    }),
    true,
  );

  assert.equal(
    usableScanQuestion({
      questionKey: "x",
      partKeys: ["a"],
      note: "",
      rows: lettered,
    }),
    false,
  );
  assert.equal(
    usableScanQuestion({
      questionKey: "3",
      partKeys: [],
      note: "",
      rows: [],
    }),
    false,
  );
  assert.match(scanBatchInstruction(1, 2, {}), /empty partKey/);

  const shortRows = flattenRawQuestion({
    questionKey: "（3）",
    parts: [{ partKey: "", prompt: "求 x。", maxScore: 2 }],
  });
  assert.equal(shortRows[0].parentKey, "3");
  assert.equal(
    usableScanQuestion({
      questionKey: shortRows[0].parentKey,
      partKeys: [],
      note: "",
      rows: shortRows,
    }),
    true,
  );

  const shortStem = preferQuestionWording(
    flattenRawQuestion({
      questionKey: "4",
      stem: "化簡下列各式，並寫出步驟。",
      parts: [{ partKey: "", prompt: "化簡", maxScore: 3 }],
    }),
  );
  assert.match(shortStem[0].prompt, /化簡下列各式/);
  assert.equal(
    usableScanQuestion({
      questionKey: "4",
      partKeys: [],
      note: "",
      rows: shortStem,
    }),
    true,
  );
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

test("reads printed marks written as text and normalises question numbers", () => {
  const allocation = readMarkAllocation({
    allocation: [
      { questionKey: "第1題", maxScore: "5分" },
      { questionKey: "Q2", marks: "（11 分）" },
      { questionKey: "３", maxScore: 4 },
    ],
  });
  assert.deepEqual(allocation, { "1": 5, "2": 11, "3": 4 });

  const row = flattenRawQuestion({
    questionKey: "Q1",
    parts: [{ partKey: "", prompt: "求 2x + 3 = 11 的解，並寫出驗算。", maxScore: "5分" }],
  });
  assert.equal(row[0].parentKey, "1");
  assert.equal(row[0].questionKey, "1");
  assert.equal(row[0].maxScore, 5);
});

test("stores undivided questions and does not collapse a split that is already present", () => {
  const whole = flattenRawQuestion({
    questionKey: "2",
    parts: [{ partKey: "", prompt: "如圖，AB = AC，∠ABC = 50°。求 ∠BAC。", maxScore: 4 }],
  });
  const stored = mergeParentRows([], whole, 4);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].partKey, "");
  assert.equal(stored[0].maxScore, 4);

  const lettered = flattenRawQuestion({
    questionKey: "1",
    parts: [
      { partKey: "a", prompt: "求 2x + 3 = 11 的解。", maxScore: 2 },
      { partKey: "b", prompt: "把答案代回方程說明是否正確。", maxScore: 3 },
    ],
  });
  const collapsed = flattenRawQuestion({
    questionKey: "1",
    parts: [{ partKey: "", prompt: "解方程並驗算，這是整題而非分題。", maxScore: 5 }],
  });
  const kept = mergeParentRows(lettered, collapsed, 5);
  assert.deepEqual(
    kept.map((row) => row.partKey),
    ["a", "b"],
  );
});

test("does not count the whole question again on top of its lettered parts", () => {
  const rows = flattenRawQuestion({
    questionKey: "4",
    maxScore: 11,
    parts: [
      { partKey: "", prompt: "A long shared question that should not be an extra part.", maxScore: 11 },
      { partKey: "a(i)", prompt: "Calculate the force on the car.", maxScore: 3 },
      { partKey: "a(ii)", prompt: "Find the acceleration of the car.", maxScore: 2 },
      { partKey: "b", prompt: "Explain the energy change in the system.", maxScore: 4 },
      { partKey: "c", prompt: "State the assumption used above.", maxScore: 2 },
    ],
  });
  assert.deepEqual(
    rows.map((row) => row.partKey),
    ["a(i)", "a(ii)", "b", "c"],
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.maxScore, 0),
    11,
  );
});

test("fits questions 1 to 9 onto the cover table", () => {
  const allocation = Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => [String(index + 1), (index % 3) + 3]),
  );
  let rows: ReturnType<typeof flattenRawQuestion> = [];
  for (let n = 1; n <= 9; n += 1) {
    const incoming = flattenRawQuestion({
      questionKey: `Q${n}`,
      maxScore: "1分",
      parts: [
        {
          partKey: "",
          prompt: `第${n}題的完整題幹，要求學生寫出計算步驟。`,
          maxScore: "1分",
        },
      ],
    });
    rows = mergeParentRows(rows, incoming, allocation[String(n)]);
  }
  assert.equal(rows.length, 9);
  const reconciled = reconcileToMarkAllocation(rows, allocation);
  assert.deepEqual(questionsOffMarkAllocation(reconciled.rows, reconciled.allocation), []);
  assert.deepEqual(
    reconciled.rows.map((row) => row.maxScore),
    [3, 4, 5, 3, 4, 5, 3, 4, 5],
  );
});

test("scales lettered parts so the question total matches the cover", () => {
  const rows = flattenRawQuestion({
    questionKey: "7",
    parts: [
      { partKey: "a", prompt: "Explain why the fringe equation is not accurate here.", maxScore: 2 },
      { partKey: "b", prompt: "Calculate the new fringe separation for this setup.", maxScore: 2 },
    ],
  });
  const reconciled = reconcileToMarkAllocation(rows, { "7": 5 });
  assert.equal(
    reconciled.rows.reduce((sum, row) => sum + row.maxScore, 0),
    5,
  );
  assert.deepEqual(questionsOffMarkAllocation(reconciled.rows, reconciled.allocation), []);
});

test("uses the marks printed on each part when they add up to the cover total", () => {
  const rows = flattenRawQuestion({
    questionKey: "2",
    parts: [
      { partKey: "a", prompt: "Estimate the power supplied to the water. (3 marks)", maxScore: 8 },
      { partKey: "b", prompt: "Find the flow rate of the water. (5 marks)", maxScore: 8 },
    ],
  });
  const reconciled = reconcileToMarkAllocation(rows, { "2": 8 });
  assert.deepEqual(
    reconciled.rows.map((row) => row.maxScore),
    [3, 5],
  );
});

test("ignores a blank cover grid that repeats the question numbers", () => {
  const rows = [1, 2, 3].flatMap((n) =>
    flattenRawQuestion({
      questionKey: String(n),
      parts: [{ partKey: "", prompt: `題目${n}的完整題幹內容在此處。`, maxScore: 4 }],
    }),
  );
  const reconciled = reconcileToMarkAllocation(rows, { "1": 1, "2": 2, "3": 3 });
  assert.deepEqual(reconciled.allocation, {});
  assert.deepEqual(
    reconciled.rows.map((row) => row.maxScore),
    [4, 4, 4],
  );
});

test("a missing cover question is reported without dropping the questions already read", () => {
  const rows = flattenRawQuestion({
    questionKey: "1",
    parts: [{ partKey: "", prompt: "求 2x + 3 = 11 的解，並寫出驗算。", maxScore: 5 }],
  });
  const allocation = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [String(index + 1), 5]),
  );
  assert.deepEqual(missingAllocatedQuestions(rows, allocation), ["2", "3", "4", "5", "6", "7", "8"]);
  const recovered = scanBatchInstruction(2, 4, allocation, ["2", "3", "4"]);
  assert.match(recovered, /still missing/);
  assert.match(recovered, /even when it is short/);
  assert.doesNotMatch(recovered, /omit the question/);
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
