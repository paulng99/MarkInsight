/**
 * Exam-structure question shape shared by analysis, cache, and the teacher UI.
 * Numbered questions stay intact; lettered parts hang off the parent.
 */

export type FlatStructureQuestion = {
  questionKey: string;
  parentKey: string;
  partKey: string;
  stem: string;
  prompt: string;
  topic: string;
  topicZh: string;
  topicEn: string;
  itemType: string;
  itemTypeZh: string;
  itemTypeEn: string;
  questionCategory: string;
  questionCategoryZh: string;
  questionCategoryEn: string;
  maxScore: number;
  assessmentObjective: string;
  assessmentObjectiveZh: string;
  assessmentObjectiveEn: string;
  difficultyPoints: string;
  difficultyPointsZh: string;
  difficultyPointsEn: string;
  /** Syllabus learning content for this part, not the exam wording. */
  teachingContent: string;
  teachingContentZh: string;
  teachingContentEn: string;
  /** Official answer copied from the uploaded answer key. */
  modelAnswer: string;
  /** How each mark is awarded, copied from the uploaded answer key. */
  markingCriteria: string;
};

export type StructurePartView = {
  questionKey: string;
  partKey: string;
  prompt: string;
  maxScore: number;
  itemType: string;
  itemTypeZh: string;
  itemTypeEn: string;
  questionCategory: string;
  questionCategoryZh: string;
  questionCategoryEn: string;
  assessmentObjective: string;
  assessmentObjectiveZh: string;
  assessmentObjectiveEn: string;
  difficultyPoints: string;
  difficultyPointsZh: string;
  difficultyPointsEn: string;
  teachingContent: string;
  teachingContentZh: string;
  teachingContentEn: string;
};

export type StructureQuestionGroup = {
  questionKey: string;
  stem: string;
  topic: string;
  topicZh: string;
  topicEn: string;
  itemType: string;
  itemTypeZh: string;
  itemTypeEn: string;
  questionCategory: string;
  questionCategoryZh: string;
  questionCategoryEn: string;
  maxScore: number;
  assessmentObjective: string;
  assessmentObjectiveZh: string;
  assessmentObjectiveEn: string;
  difficultyPoints: string;
  difficultyPointsZh: string;
  difficultyPointsEn: string;
  parts: StructurePartView[];
};

export type StructureDraft = {
  questionKey: string | null;
  note: string | null;
};

export type DigestedQuestion = {
  questionKey: string;
  partKeys: string[];
  note: string;
  rows: FlatStructureQuestion[];
};

/** Appended at request time so older saved prompts still return full wording. */
export const STRUCTURE_PROMPT_ADDENDUM = [
  "Additional output rules, even if the schema above omits them:",
  'Begin the JSON with {"total": <count of numbered questions on the paper>, "questions": [...]} and write questions in paper order.',
  "Return one object per numbered question (1, 2, 3…). A 10-question paper must contain 10 objects. Do not drop questions.",
  "Put every lettered or roman part inside parts: (a), (b), (c), (i), (ii), and （甲）（乙） when the paper uses them. Do not skip a part.",
  "Each part needs its own copied prompt, its own maxScore, and its own assessmentObjective and difficultyPoints. Do not analyse only the whole question.",
  "stem is the shared wording copied in full from the paper, without the part text. Each part prompt is that part's wording copied in full. Do not summarise, translate, or shorten.",
  "An empty partKey is invalid when the paper shows lettered parts. Do not merge (a) and (b) into one prompt.",
  'Put workingNote immediately after questionKey: one short sentence in the paper\'s language describing what you are checking on this question.',
  "part maxScore is that part's mark. The question maxScore is the sum of its parts.",
  "When a syllabus excerpt is provided, itemType (題型) and questionCategory (題目種類) must follow that syllabus. Do not invent a label the syllabus does not support.",
  'Write assessmentObjective, difficultyPoints, itemType, questionCategory, topic, and teachingContent in both Traditional Chinese (Hong Kong) and English. Prefer objects {"zh":"...","en":"..."} or the paired keys topicZh/topicEn, itemTypeZh/itemTypeEn, questionCategoryZh/questionCategoryEn, assessmentObjectiveZh/assessmentObjectiveEn, difficultyPointsZh/difficultyPointsEn, teachingContentZh/teachingContentEn.',
].join(" ");

/**
 * Page batches only show part of a scanned paper. This overrides the rule that
 * the reply must contain every numbered question.
 */
export const SCAN_BATCH_OVERRIDE = [
  "This request overrides the rule that a paper must contain every numbered question.",
  "These images are only a few pages.",
  "Return only numbered questions whose printed wording is visible on these pages.",
  "Omit every question that is not visible. A short list is the correct result.",
  "Do not invent a question, a part, or a mark.",
  "Do not replace a question with a curriculum outcome, a syllabus statement, or a textbook summary.",
  "Keep nested labels separate: (b)(i) and (b)(ii) are partKey values b(i) and b(ii).",
  "maxScore is the integer printed for that part, such as (2 marks) or (3 分).",
].join(" ");

export function scanPageSystemPrompt(base: string): string {
  return `${base.trim()}\n\n${STRUCTURE_PROMPT_ADDENDUM}\n\n${SCAN_BATCH_OVERRIDE}`;
}

export function formatMarkAllocation(allocation: Record<string, number>): string {
  return Object.entries(allocation)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, score]) => `${key}=${score}`)
    .join(", ");
}

/** Cover-page marks table: question number to that question's printed total. */
export function readMarkAllocation(parsed: unknown): Record<string, number> {
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const list = Array.isArray(record?.allocation)
    ? record.allocation
    : Array.isArray(record?.marks)
      ? record.marks
      : [];
  const out: Record<string, number> = {};
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rawKey = textOf(row.questionKey || row.key || row.question).replace(/^Q/i, "");
    const parent = splitQuestionKey(rawKey).parentKey || rawKey;
    if (!/^\d+$/.test(parent)) continue;
    const score = marks(row.maxScore ?? row.marks ?? row.score, 0);
    if (score <= 0) continue;
    out[parent] = score;
  }
  return out;
}

export function questionsOffMarkAllocation(
  rows: FlatStructureQuestion[],
  allocation: Record<string, number>,
): string[] {
  const totals = questionTotals(rows);
  return Object.keys(allocation)
    .sort((a, b) => Number(a) - Number(b))
    .filter((key) => totals.get(key) !== allocation[key]);
}

export function limitToMarkAllocation(
  rows: FlatStructureQuestion[],
  allocation: Record<string, number>,
): FlatStructureQuestion[] {
  const keys = Object.keys(allocation);
  if (keys.length === 0) return rows;
  const allowed = new Set(keys);
  return rows.filter((row) => allowed.has(row.parentKey));
}

function questionTotals(rows: FlatStructureQuestion[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.parentKey, (totals.get(row.parentKey) ?? 0) + (row.maxScore || 0));
  }
  return totals;
}

/** Mark printed at the end of a part, such as "(3 marks)", "（2 分）", or "[4]". */
function printedPartMark(prompt: string): number | null {
  const text = prompt.replace(/\s+/g, " ").trim();
  const patterns = [
    /[(（]\s*(\d+(?:\.\d+)?)\s*(?:marks?|分)\s*[)）]\s*[.。]?\s*$/i,
    /\[\s*(\d+(?:\.\d+)?)\s*(?:marks?|分)?\s*\]\s*[.。]?\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const score = Number(match[1]);
    if (Number.isFinite(score) && score > 0) return score;
  }
  return null;
}

function apportionMarks(weights: number[], total: number): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const units = Math.round(total * 2);
  const safe = weights.map((weight) => (weight > 0 ? weight : 0));
  const weightSum = safe.reduce((sum, weight) => sum + weight, 0);
  const base = weightSum > 0 ? safe : safe.map(() => 1);
  const denom = base.reduce((sum, weight) => sum + weight, 0);
  const exact = base.map((weight) => {
    const value = (weight / denom) * units;
    return Math.round(value * 1e9) / 1e9;
  });
  const floors = exact.map((value) => Math.floor(value));
  let left = units - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] += 1;
    left -= 1;
  }
  return floors.map((unit) => unit / 2);
}

function fitGroupToTotal(group: FlatStructureQuestion[], expected: number): FlatStructureQuestion[] {
  const sum = group.reduce((total, row) => total + (row.maxScore || 0), 0);
  if (sum === expected) return group;
  const printed = group.map((row) => printedPartMark(row.prompt));
  if (printed.every((score): score is number => score != null)) {
    const printedSum = printed.reduce((total, score) => total + score, 0);
    if (printedSum === expected) {
      return group.map((row, index) => ({ ...row, maxScore: printed[index]! }));
    }
    if (group.length > 1) {
      const shares = apportionMarks(printed, expected);
      return group.map((row, index) => ({ ...row, maxScore: shares[index]! }));
    }
  }
  if (group.length === 1) return [{ ...group[0]!, maxScore: expected }];
  const shares = apportionMarks(
    group.map((row) => row.maxScore || 0),
    expected,
  );
  return group.map((row, index) => ({ ...row, maxScore: shares[index]! }));
}

/**
 * A blank marker grid is often read as "question 1 is worth 1, question 2 is worth 2".
 * When every extracted question disagrees with that pattern, the table is not a printed allocation.
 */
function isBlankScoreGrid(
  rows: FlatStructureQuestion[],
  allocation: Record<string, number>,
): boolean {
  const keys = Object.keys(allocation);
  if (keys.length < 2) return false;
  if (!keys.every((key) => allocation[key] === Number(key))) return false;
  const totals = questionTotals(rows);
  const compared = keys.filter((key) => totals.has(key));
  if (compared.length === 0) return false;
  return compared.every((key) => totals.get(key) !== allocation[key]);
}

/**
 * Make each extracted question add up to the cover table.
 * An undivided question takes the cover total. Lettered parts keep printed marks when those already add up.
 */
export function reconcileToMarkAllocation(
  rows: FlatStructureQuestion[],
  allocation: Record<string, number>,
): { rows: FlatStructureQuestion[]; allocation: Record<string, number> } {
  if (Object.keys(allocation).length === 0) return { rows, allocation };
  if (isBlankScoreGrid(rows, allocation)) return { rows, allocation: {} };

  const groups = new Map<string, FlatStructureQuestion[]>();
  const order: string[] = [];
  for (const row of rows) {
    if (!groups.has(row.parentKey)) {
      groups.set(row.parentKey, []);
      order.push(row.parentKey);
    }
    groups.get(row.parentKey)!.push(row);
  }
  const next = order.flatMap((parent) => {
    const group = groups.get(parent)!;
    const expected = allocation[parent];
    if (!expected) return group;
    return fitGroupToTotal(group, expected);
  });
  return { rows: next, allocation };
}

export function scanBatchInstruction(
  from: number,
  to: number,
  allocation: Record<string, number>,
  onlyKeys?: string[],
): string {
  const keys = onlyKeys?.filter((key) => allocation[key] != null);
  const focus =
    keys && keys.length > 0
      ? `Return a question only when its number is one of: ${keys.join(", ")}. `
      : "";
  const scoped =
    keys && keys.length > 0
      ? Object.fromEntries(keys.map((key) => [key, allocation[key]]))
      : allocation;
  const totals = formatMarkAllocation(scoped);
  const totalLine = totals
    ? `Printed question totals: ${totals}. Parts of a question should sum to that question's total. `
    : "";
  const recoverLine =
    keys && keys.length > 0
      ? "These question numbers are still missing. If the number is printed on these pages, return that question even when it is short and even when only some of its parts are visible. Do not skip a visible question number. "
      : "Return every numbered question visible on these pages, including a short question with no lettered parts. If a question continues on another page, return the wording that is visible here. ";
  return (
    `These upright images are question-paper pages ${from}–${to}. ` +
    focus +
    recoverLine +
    "Do not add questions that are not on these pages. " +
    "Copy each lettered part in the paper's language. Do not summarise, translate, or invent a question. " +
    "partKey is the printed label without the question number, such as a, b, c, b(i), or b(ii). " +
    "If the question has no lettered parts, return exactly one part with an empty partKey and the full question wording. " +
    "maxScore is the mark printed for that part (or the whole question when partKey is empty). " +
    "questionKey is the question number alone, such as 1, and maxScore is a number. " +
    totalLine +
    "Write assessmentObjective (考核要求) and difficultyPoints (難點) in Traditional Chinese (Hong Kong), about that part only. " +
    "Skip cover pages, instructions, and blank answer lines."
  );
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const BILINGUAL_FIELDS = [
  "topic",
  "itemType",
  "questionCategory",
  "assessmentObjective",
  "difficultyPoints",
  "teachingContent",
] as const;

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function nestedLang(value: unknown, side: "zh" | "en"): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return textOf((value as Record<string, unknown>)[side]);
}

/** Fill separate Chinese and English columns. A legacy single string lands on the side that matches its script. */
function attachBilingual<T extends Record<(typeof BILINGUAL_FIELDS)[number], string>>(
  row: T,
  source: Record<string, unknown>,
): T & Record<`${(typeof BILINGUAL_FIELDS)[number]}Zh` | `${(typeof BILINGUAL_FIELDS)[number]}En`, string> {
  const extra: Record<string, string> = {};
  for (const key of BILINGUAL_FIELDS) {
    const explicitZh = textOf(source[`${key}Zh`]) || nestedLang(source[key], "zh");
    const explicitEn = textOf(source[`${key}En`]) || nestedLang(source[key], "en");
    const legacy = row[key];
    const skip = legacy === "" || legacy === "—" || legacy === "short";
    const zh = explicitZh || (!skip && hasCjk(legacy) ? legacy : "");
    const en = explicitEn || (!skip && legacy && !hasCjk(legacy) ? legacy : "");
    extra[`${key}Zh`] = key === "teachingContent" ? tidyTeachingContent(zh) : zh;
    extra[`${key}En`] = key === "teachingContent" ? tidyTeachingContent(en) : en;
  }
  return { ...row, ...extra } as T &
    Record<`${(typeof BILINGUAL_FIELDS)[number]}Zh` | `${(typeof BILINGUAL_FIELDS)[number]}En`, string>;
}

function foldDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
}

function marks(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const match = foldDigits(value).match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return fallback;
}

/** "Q1", "第1題", "（2）", "1." and full-width digits all become the question number. */
export function canonicalQuestionNumber(raw: string): string {
  const folded = foldDigits(raw.trim());
  const stripped = folded.replace(/^[（(]\s*/, "").replace(/[)）]\s*$/, "");
  const match = stripped.match(/^(?:第\s*)?(?:Q|題)?\s*0*(\d+)\s*(?:題)?[.．、]?\s*$/i);
  if (!match) return raw.trim();
  return String(Number(match[1]));
}

export function splitQuestionKey(key: string): { parentKey: string; partKey: string } {
  const trimmed = key.trim();
  const paren = trimmed.match(/^(.*?)[(（]\s*([a-z0-9ivx]+)\s*[)）]$/i);
  if (paren?.[1]?.trim()) {
    return { parentKey: canonicalQuestionNumber(paren[1].trim()), partKey: paren[2] };
  }
  const suffix = trimmed.match(/^(Q?\d+)\s*([a-z])$/i);
  if (suffix) {
    return { parentKey: canonicalQuestionNumber(suffix[1]), partKey: suffix[2].toLowerCase() };
  }
  return { parentKey: canonicalQuestionNumber(trimmed), partKey: "" };
}

export function formatQuestionKey(parentKey: string, partKey: string): string {
  const part = partKey.trim();
  const parent = parentKey.trim();
  if (!part) return parent;
  if (splitQuestionKey(parent).partKey) return parent;
  return `${parent}(${part})`;
}

export function flattenRawQuestion(raw: Record<string, unknown>): FlatStructureQuestion[] {
  const keyText = textOf(raw.questionKey || raw.key || raw.number);
  if (!keyText && !textOf(raw.stem || raw.prompt || raw.questionText || raw.text)) return [];

  const split = splitQuestionKey(keyText || "Q");
  const stem = textOf(raw.stem || raw.prompt || raw.questionText || raw.text || raw.content);
  const topic = textOf(raw.topic) || "—";
  const itemType = textOf(raw.itemType || raw.type) || "short";
  const questionCategory = textOf(raw.questionCategory);
  const assessmentObjective = textOf(raw.assessmentObjective || raw.objective);
  const difficultyPoints = textOf(raw.difficultyPoints || raw.difficulty || raw.hardPoints);
  const partsRaw = Array.isArray(raw.parts) ? raw.parts : null;
  const parentKey = partsRaw && partsRaw.length > 0 ? split.parentKey : split.parentKey;

  if (!partsRaw || partsRaw.length === 0) {
    const partKey = split.partKey;
    return [
      attachBilingual(
        {
          questionKey: formatQuestionKey(parentKey, partKey),
          parentKey,
          partKey,
          stem: partKey ? "" : stem,
          prompt: stem,
          topic,
          itemType,
          questionCategory,
          maxScore: marks(raw.maxScore, 1),
          assessmentObjective,
          difficultyPoints,
          teachingContent: textOf(raw.teachingContent),
          modelAnswer: textOf(raw.modelAnswer),
          markingCriteria: textOf(raw.markingCriteria),
        },
        raw,
      ),
    ];
  }

  const partRecords = partsRaw.flatMap((part) =>
    part && typeof part === "object" ? [part as Record<string, unknown>] : [],
  );
  const explicitKeys = partRecords.map((record) => textOf(record.partKey || record.key || record.label));
  const anyExplicit = explicitKeys.some((key) => key.length > 0);

  return partRecords.flatMap((record, index) => {
    const explicit = explicitKeys[index] ?? "";
    // A blank part beside real (a)/(b) rows is the whole question repeated, not another part.
    if (!explicit && anyExplicit) return [];
    const resolvedPart = explicit || (partRecords.length === 1 ? "" : String.fromCharCode(97 + index));
    const prompt =
      textOf(record.prompt || record.stem || record.text || record.content) || stem;
    return [
      attachBilingual(
        {
          questionKey: formatQuestionKey(parentKey, resolvedPart),
          parentKey,
          partKey: resolvedPart,
          stem,
          prompt,
          topic: textOf(record.topic) || topic,
          itemType: textOf(record.itemType || record.type) || itemType,
          questionCategory: textOf(record.questionCategory) || questionCategory,
          maxScore: marks(record.maxScore, partRecords.length === 1 ? marks(raw.maxScore, 1) : 0),
          assessmentObjective:
            textOf(record.assessmentObjective || record.objective) || assessmentObjective,
          difficultyPoints:
            textOf(record.difficultyPoints || record.difficulty || record.hardPoints) ||
            difficultyPoints,
          teachingContent: textOf(record.teachingContent) || textOf(raw.teachingContent),
          modelAnswer: textOf(record.modelAnswer) || textOf(raw.modelAnswer),
          markingCriteria: textOf(record.markingCriteria) || textOf(raw.markingCriteria),
        },
        { ...raw, ...record },
      ),
    ];
  });
}

export function flattenStructurePayload(parsed: unknown): FlatStructureQuestion[] {
  const record =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const list = Array.isArray(record?.questions)
    ? record.questions
    : Array.isArray(parsed)
      ? parsed
      : [];
  return list.flatMap((item) =>
    item && typeof item === "object" ? flattenRawQuestion(item as Record<string, unknown>) : [],
  );
}

export function groupStructureQuestions(rows: FlatStructureQuestion[]): StructureQuestionGroup[] {
  const order: string[] = [];
  const map = new Map<string, FlatStructureQuestion[]>();
  for (const row of rows) {
    const parent = row.parentKey || splitQuestionKey(row.questionKey).parentKey;
    if (!map.has(parent)) {
      map.set(parent, []);
      order.push(parent);
    }
    map.get(parent)!.push(row);
  }

  return order.map((parent) => {
    const items = map.get(parent)!;
    const first = items[0];
    const stem = items.map((item) => item.stem.trim()).find(Boolean) || "";
    const parts: StructurePartView[] = items.map((item) => ({
      questionKey: item.questionKey,
      partKey: item.partKey,
      prompt: item.prompt,
      maxScore: item.maxScore,
      itemType: item.itemType,
      itemTypeZh: item.itemTypeZh,
      itemTypeEn: item.itemTypeEn,
      questionCategory: item.questionCategory,
      questionCategoryZh: item.questionCategoryZh,
      questionCategoryEn: item.questionCategoryEn,
      assessmentObjective: item.assessmentObjective,
      assessmentObjectiveZh: item.assessmentObjectiveZh,
      assessmentObjectiveEn: item.assessmentObjectiveEn,
      difficultyPoints: item.difficultyPoints,
      difficultyPointsZh: item.difficultyPointsZh,
      difficultyPointsEn: item.difficultyPointsEn,
      teachingContent: item.teachingContent,
      teachingContentZh: item.teachingContentZh,
      teachingContentEn: item.teachingContentEn,
    }));
    const sum = parts.reduce((total, part) => total + (part.maxScore || 0), 0);
    return {
      questionKey: parent,
      stem,
      topic: first.topic,
      topicZh: first.topicZh,
      topicEn: first.topicEn,
      itemType: first.itemType,
      itemTypeZh: first.itemTypeZh,
      itemTypeEn: first.itemTypeEn,
      questionCategory: first.questionCategory,
      questionCategoryZh: first.questionCategoryZh,
      questionCategoryEn: first.questionCategoryEn,
      maxScore: sum || first.maxScore,
      assessmentObjective: first.assessmentObjective,
      assessmentObjectiveZh: first.assessmentObjectiveZh,
      assessmentObjectiveEn: first.assessmentObjectiveEn,
      difficultyPoints: first.difficultyPoints,
      difficultyPointsZh: first.difficultyPointsZh,
      difficultyPointsEn: first.difficultyPointsEn,
      parts,
    };
  });
}

function questionWording(row: FlatStructureQuestion): string {
  const prompt = row.prompt.trim();
  const stem = row.stem.trim();
  return prompt.length >= stem.length ? prompt : stem;
}

/** Use the fuller of stem and prompt for an undivided question. */
export function preferQuestionWording(rows: FlatStructureQuestion[]): FlatStructureQuestion[] {
  return rows.map((row) => {
    if (row.partKey.trim()) return row;
    const stem = row.stem.trim();
    if (stem.length > row.prompt.trim().length) return { ...row, prompt: stem };
    return row;
  });
}

/**
 * Whether a streamed / scanned question object is worth keeping.
 * Lettered parts need non-empty partKeys. A short undivided question may use
 * one or more rows with an empty partKey; Hong Kong papers often print these
 * in a single sentence.
 */
export function usableScanQuestion(item: DigestedQuestion): boolean {
  if (!/^\d+$/.test(item.questionKey)) return false;
  if (item.rows.length === 0) return false;
  if (item.rows.some((row) => /shared stem/i.test(`${row.stem} ${row.prompt}`))) {
    return false;
  }
  const hasLetteredParts = item.partKeys.length > 0;
  const undivided = item.rows.every((row) => !row.partKey.trim());
  if (!hasLetteredParts && !undivided) return false;
  return item.rows.some((row) => {
    const wording = questionWording(row);
    if (wording.length >= 8) return true;
    return wording.length >= 2 && /[\u4e00-\u9fffA-Za-z0-9]/.test(wording);
  });
}

/** Cover-table numbers that never appeared in the extracted paper. */
export function missingAllocatedQuestions(
  rows: FlatStructureQuestion[],
  allocation: Record<string, number>,
): string[] {
  const present = new Set(rows.map((row) => row.parentKey));
  return Object.keys(allocation)
    .sort((a, b) => Number(a) - Number(b))
    .filter((key) => !present.has(key));
}

/** Parent keys that were stored as one block, with no lettered part. */
export function parentsMissingParts(rows: FlatStructureQuestion[]): string[] {
  const order: string[] = [];
  const map = new Map<string, FlatStructureQuestion[]>();
  for (const row of rows) {
    const parent = row.parentKey || splitQuestionKey(row.questionKey).parentKey;
    if (!map.has(parent)) {
      map.set(parent, []);
      order.push(parent);
    }
    map.get(parent)!.push(row);
  }
  return order.filter((parent) => !map.get(parent)!.some((row) => row.partKey.trim()));
}

function partPromptKey(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/^\s*[(（]?[a-zivx]+[)）.]?\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

function partSpecificity(partKey: string): number {
  return partKey.replace(/[^a-z0-9]/gi, "").length;
}

const SYLLABUS_SIGNAL =
  /assessment objective|kinds of items|multiple-choice|multiple choice|structured question|short question|essay|curriculum structure|compulsory part|learning outcome|題型|評估目標|課題/gi;
const LEARN_SIGNAL = /students should learn|should be able to|學生應學習|學生應能/i;

function tidyTeachingContent(text: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/^[-•*]\s*/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(trimmed);
  }
  return lines.join("\n");
}

function hintScore(text: string, hints: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const hint of hints) {
    for (const word of hint.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/)) {
      if (word.length > 3 && lower.includes(word)) score += 1;
    }
  }
  return score;
}

/** Keep assessment pages and the syllabus pages that state what students should learn. */
export function selectSyllabusText(
  pages: string[],
  maxChars = 36_000,
  hints: string[] = [],
): string {
  const scored = pages
    .map((text, index) => ({
      index,
      text: text.replace(/\s+/g, " ").trim(),
      score: text.match(SYLLABUS_SIGNAL)?.length ?? 0,
      learn: LEARN_SIGNAL.test(text),
      hint: hintScore(text, hints),
    }))
    .filter((page) => page.text.length > 40);
  const assessment = scored.filter((page) => page.score > 0);
  const learn = scored
    .filter((page) => page.learn && (hints.length === 0 || page.hint > 0))
    .sort((a, b) => b.hint - a.hint || a.index - b.index);
  const picked = [...learn, ...assessment.filter((page) => !learn.includes(page))];
  const chosen = picked.length > 0 ? picked : scored.slice(0, 8);
  const ordered = [...chosen].sort((a, b) => a.index - b.index);
  let excerpt = "";
  for (const page of ordered) {
    const block = `\n\n[syllabus page ${page.index + 1}]\n${page.text}`;
    if (excerpt.length + block.length > maxChars) continue;
    excerpt += block;
  }
  return excerpt.trim();
}

export type SyllabusLabel = {
  questionKey?: string;
  itemType?: string;
  itemTypeZh?: string;
  itemTypeEn?: string;
  questionCategory?: string;
  questionCategoryZh?: string;
  questionCategoryEn?: string;
  topic?: string;
  topicZh?: string;
  topicEn?: string;
  teachingContent?: string;
  teachingContentZh?: string;
  teachingContentEn?: string;
  assessmentObjective?: string;
  assessmentObjectiveZh?: string;
  assessmentObjectiveEn?: string;
  difficultyPoints?: string;
  difficultyPointsZh?: string;
  difficultyPointsEn?: string;
};

function mergeBilingualField(
  row: FlatStructureQuestion,
  label: SyllabusLabel,
  key: (typeof BILINGUAL_FIELDS)[number],
): { text: string; zh: string; en: string } {
  const source = label as Record<string, unknown>;
  const explicitZh = textOf(source[`${key}Zh`]) || nestedLang(source[key], "zh");
  const explicitEn = textOf(source[`${key}En`]) || nestedLang(source[key], "en");
  const legacy = typeof source[key] === "string" ? textOf(source[key]) : "";
  const zhRaw = explicitZh || (legacy && hasCjk(legacy) ? legacy : "") || row[`${key}Zh`];
  const enRaw = explicitEn || (legacy && !hasCjk(legacy) ? legacy : "") || row[`${key}En`];
  const zh = key === "teachingContent" ? tidyTeachingContent(zhRaw) : zhRaw;
  const en = key === "teachingContent" ? tidyTeachingContent(enRaw) : enRaw;
  const preferZh = key !== "topic";
  const text = (preferZh ? zh || en : en || zh) || legacy || row[key];
  return { text, zh, en };
}

/** Replace 題型 and 題目種類 from a syllabus classification, leaving the question wording in place. */
export function applySyllabusLabels(
  rows: FlatStructureQuestion[],
  labels: SyllabusLabel[],
): FlatStructureQuestion[] {
  const byKey = new Map<string, SyllabusLabel>();
  for (const label of labels) {
    const key = textOf(label.questionKey);
    if (key) byKey.set(key, label);
  }
  return rows.map((row) => {
    const label =
      byKey.get(row.questionKey) ||
      byKey.get(formatQuestionKey(row.parentKey, row.partKey));
    if (!label) return row;
    const topic = mergeBilingualField(row, label, "topic");
    const itemType = mergeBilingualField(row, label, "itemType");
    const questionCategory = mergeBilingualField(row, label, "questionCategory");
    const assessmentObjective = mergeBilingualField(row, label, "assessmentObjective");
    const difficultyPoints = mergeBilingualField(row, label, "difficultyPoints");
    const teachingContent = mergeBilingualField(row, label, "teachingContent");
    return {
      ...row,
      topic: topic.text,
      topicZh: topic.zh,
      topicEn: topic.en,
      itemType: itemType.text,
      itemTypeZh: itemType.zh,
      itemTypeEn: itemType.en,
      questionCategory: questionCategory.text,
      questionCategoryZh: questionCategory.zh,
      questionCategoryEn: questionCategory.en,
      assessmentObjective: assessmentObjective.text,
      assessmentObjectiveZh: assessmentObjective.zh,
      assessmentObjectiveEn: assessmentObjective.en,
      difficultyPoints: difficultyPoints.text,
      difficultyPointsZh: difficultyPoints.zh,
      difficultyPointsEn: difficultyPoints.en,
      teachingContent: teachingContent.text,
      teachingContentZh: teachingContent.zh,
      teachingContentEn: teachingContent.en,
    };
  });
}

/** Drop a part that repeats another part of the same question. */
export function dedupePartRows(rows: FlatStructureQuestion[]): FlatStructureQuestion[] {
  const order: string[] = [];
  const map = new Map<string, FlatStructureQuestion[]>();
  for (const row of rows) {
    const parent = row.parentKey || splitQuestionKey(row.questionKey).parentKey;
    if (!map.has(parent)) {
      map.set(parent, []);
      order.push(parent);
    }
    map.get(parent)!.push(row);
  }

  return order.flatMap((parent) => {
    const source = map.get(parent)!;
    const lettered = source.filter((row) => row.partKey.trim());
    const pool = lettered.length > 0 ? lettered : source;
    const kept: FlatStructureQuestion[] = [];
    for (const row of pool) {
      const key = partPromptKey(row.prompt);
      const index = kept.findIndex((item) => {
        const other = partPromptKey(item.prompt);
        if (!key || !other) return false;
        if (key === other) return true;
        const [shorter, longer] = key.length < other.length ? [key, other] : [other, key];
        return shorter.length >= 40 && longer.includes(shorter);
      });
      if (index < 0) {
        kept.push(row);
        continue;
      }
      const current = kept[index];
      const preferRow =
        partSpecificity(row.partKey) > partSpecificity(current.partKey) ||
        (partSpecificity(row.partKey) === partSpecificity(current.partKey) &&
          row.prompt.trim().length > current.prompt.trim().length);
      if (preferRow) kept[index] = row;
    }
    return kept;
  });
}

/** Keep the fuller wording when the same part is seen again on a later page. */
export function mergeParentRows(
  current: FlatStructureQuestion[],
  incoming: FlatStructureQuestion[],
  expectedMax?: number,
): FlatStructureQuestion[] {
  const parent = incoming[0]?.parentKey;
  if (!parent) return current;

  let next = incoming;
  if (next.some((row) => row.partKey.trim())) {
    next = next.filter((row) => row.partKey.trim());
  } else if (next.length > 1) {
    const fullest = next.reduce((best, row) =>
      row.prompt.trim().length > best.prompt.trim().length ? row : best,
    );
    next = [{ ...fullest, partKey: "", questionKey: parent }];
  }

  const currentRows = current.filter((row) => row.parentKey === parent);
  const currentSum = currentRows.reduce((sum, row) => sum + (row.maxScore || 0), 0);
  const incomingSum = next.reduce((sum, row) => sum + (row.maxScore || 0), 0);
  const incomingUndivided = next.length === 1 && !next[0]!.partKey.trim();
  const currentHasParts = currentRows.some((row) => row.partKey.trim());
  if (expectedMax && expectedMax > 0) {
    const incomingReplaces =
      incomingSum === expectedMax &&
      currentSum !== expectedMax &&
      !(incomingUndivided && currentHasParts);
    if (incomingReplaces) return replaceParentQuestions(current, parent, next);
    if (currentSum === expectedMax && incomingSum !== expectedMax) return current;
  }

  if (incomingUndivided) {
    if (currentHasParts) return current;
    if (currentRows.length === 0) return replaceParentQuestions(current, parent, next);
    const prev = currentRows[0]!;
    if (next[0]!.prompt.trim().length >= prev.prompt.trim().length) {
      return replaceParentQuestions(current, parent, next);
    }
    return current;
  }

  const byPart = new Map<string, FlatStructureQuestion>();
  for (const row of currentRows) {
    if (row.partKey.trim()) byPart.set(row.partKey, row);
  }
  for (const row of next) {
    const prev = byPart.get(row.partKey);
    if (!prev || row.prompt.trim().length >= prev.prompt.trim().length) {
      byPart.set(row.partKey, row);
    }
  }
  return replaceParentQuestions(current, parent, [...byPart.values()]);
}

/** Swap in part rows for one numbered question, keeping the other questions in place. */
export function replaceParentQuestions(
  rows: FlatStructureQuestion[],
  parentKey: string,
  next: FlatStructureQuestion[],
): FlatStructureQuestion[] {
  const out: FlatStructureQuestion[] = [];
  let inserted = false;
  for (const row of rows) {
    if (row.parentKey === parentKey) {
      if (!inserted) {
        out.push(...next);
        inserted = true;
      }
      continue;
    }
    out.push(row);
  }
  if (!inserted) out.push(...next);
  return out;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function scanText(raw: string): string {
  return raw.replace(/^\uFEFF?/, "").replace(/^```(?:json)?\s*/i, "");
}

function readTotal(text: string): number {
  const match = /"total"\s*:\s*(\d+)/.exec(text);
  const n = match ? Number(match[1]) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

export function peekStructureDraft(fragment: string): StructureDraft | null {
  const questionKey = /"questionKey"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(fragment);
  const note = /"workingNote"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(fragment);
  if (!questionKey && !note) return null;
  return {
    questionKey: questionKey ? unescapeJsonString(questionKey[1]).trim() || null : null,
    note: note ? unescapeJsonString(note[1]).trim() || null : null,
  };
}

function questionNote(raw: Record<string, unknown>): string {
  return textOf(raw.workingNote || raw.note);
}

export function digestStructureBuffer(
  buffer: string,
  emitted: number,
): {
  total: number;
  fresh: DigestedQuestion[];
  draft: StructureDraft | null;
} {
  const text = scanText(buffer);
  const total = readTotal(text);
  const marker = /"questions"\s*:\s*\[/.exec(text);
  if (!marker) {
    return { total, fresh: [], draft: peekStructureDraft(text) };
  }

  const complete: DigestedQuestion[] = [];
  let i = marker.index + marker[0].length;
  let draft: StructureDraft | null = null;

  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") break;
    const end = matchingBrace(text, i);
    if (end < 0) {
      draft = peekStructureDraft(text.slice(i));
      break;
    }
    try {
      const raw = JSON.parse(text.slice(i, end + 1)) as Record<string, unknown>;
      const rows = flattenRawQuestion(raw);
      if (rows.length > 0) {
        complete.push({
          questionKey: rows[0].parentKey,
          partKeys: rows.map((row) => row.partKey).filter(Boolean),
          note: questionNote(raw),
          rows,
        });
      }
    } catch {
      draft = peekStructureDraft(text.slice(i));
      break;
    }
    i = end + 1;
  }

  return {
    total: Math.max(total, complete.length),
    fresh: complete.slice(emitted),
    draft,
  };
}

export function coerceFlatQuestion(value: Partial<FlatStructureQuestion>): FlatStructureQuestion | null {
  if (!value.questionKey) return null;
  const split = splitQuestionKey(String(value.questionKey));
  const parentKey = textOf(value.parentKey) || split.parentKey;
  const partKey = textOf(value.partKey) || split.partKey;
  return attachBilingual(
    {
      questionKey: formatQuestionKey(parentKey, partKey),
      parentKey,
      partKey,
      stem: textOf(value.stem),
      prompt: textOf(value.prompt),
      topic: textOf(value.topic) || textOf(value.topicEn) || textOf(value.topicZh) || "—",
      itemType: textOf(value.itemType) || textOf(value.itemTypeZh) || textOf(value.itemTypeEn) || "short",
      questionCategory:
        textOf(value.questionCategory) ||
        textOf(value.questionCategoryZh) ||
        textOf(value.questionCategoryEn),
      maxScore: marks(value.maxScore, 1),
      assessmentObjective:
        textOf(value.assessmentObjective) ||
        textOf(value.assessmentObjectiveZh) ||
        textOf(value.assessmentObjectiveEn),
      difficultyPoints:
        textOf(value.difficultyPoints) ||
        textOf(value.difficultyPointsZh) ||
        textOf(value.difficultyPointsEn),
      teachingContent:
        textOf(value.teachingContent) ||
        textOf(value.teachingContentZh) ||
        textOf(value.teachingContentEn),
      modelAnswer: textOf(value.modelAnswer),
      markingCriteria: textOf(value.markingCriteria),
    },
    value as Record<string, unknown>,
  );
}
