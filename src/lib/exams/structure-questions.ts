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
  itemType: string;
  questionCategory: string;
  maxScore: number;
  assessmentObjective: string;
  difficultyPoints: string;
  /** Syllabus learning content for this part, not the exam wording. */
  teachingContent: string;
};

export type StructurePartView = {
  questionKey: string;
  partKey: string;
  prompt: string;
  maxScore: number;
  itemType: string;
  questionCategory: string;
  assessmentObjective: string;
  difficultyPoints: string;
  teachingContent: string;
};

export type StructureQuestionGroup = {
  questionKey: string;
  stem: string;
  topic: string;
  itemType: string;
  questionCategory: string;
  maxScore: number;
  assessmentObjective: string;
  difficultyPoints: string;
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
].join(" ");

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function marks(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function splitQuestionKey(key: string): { parentKey: string; partKey: string } {
  const trimmed = key.trim();
  const paren = trimmed.match(/^(.*?)[(（]\s*([a-z0-9ivx]+)\s*[)）]$/i);
  if (paren?.[1]?.trim()) {
    return { parentKey: paren[1].trim(), partKey: paren[2] };
  }
  const suffix = trimmed.match(/^(Q?\d+)\s*([a-z])$/i);
  if (suffix) return { parentKey: suffix[1], partKey: suffix[2].toLowerCase() };
  return { parentKey: trimmed, partKey: "" };
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
      },
    ];
  }

  return partsRaw.flatMap((part, index) => {
    if (!part || typeof part !== "object") return [];
    const record = part as Record<string, unknown>;
    const partKey = textOf(record.partKey || record.key || record.label) || "";
    const resolvedPart = partKey || (partsRaw.length === 1 ? "" : String.fromCharCode(97 + index));
    const prompt =
      textOf(record.prompt || record.stem || record.text || record.content) || stem;
    return [
      {
        questionKey: formatQuestionKey(parentKey, resolvedPart),
        parentKey,
        partKey: resolvedPart,
        stem,
        prompt,
        topic: textOf(record.topic) || topic,
        itemType: textOf(record.itemType || record.type) || itemType,
        questionCategory: textOf(record.questionCategory) || questionCategory,
        maxScore: marks(record.maxScore, partsRaw.length === 1 ? marks(raw.maxScore, 1) : 0),
        assessmentObjective:
          textOf(record.assessmentObjective || record.objective) || assessmentObjective,
        difficultyPoints:
          textOf(record.difficultyPoints || record.difficulty || record.hardPoints) ||
          difficultyPoints,
        teachingContent: textOf(record.teachingContent) || textOf(raw.teachingContent),
      },
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
      questionCategory: item.questionCategory,
      assessmentObjective: item.assessmentObjective,
      difficultyPoints: item.difficultyPoints,
      teachingContent: item.teachingContent,
    }));
    const sum = parts.reduce((total, part) => total + (part.maxScore || 0), 0);
    return {
      questionKey: parent,
      stem,
      topic: first.topic,
      itemType: first.itemType,
      questionCategory: first.questionCategory,
      maxScore: sum || first.maxScore,
      assessmentObjective: first.assessmentObjective,
      difficultyPoints: first.difficultyPoints,
      parts,
    };
  });
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

/** Replace 題型 and 題目種類 from a syllabus classification, leaving the question wording in place. */
export function applySyllabusLabels(
  rows: FlatStructureQuestion[],
  labels: Array<{
    questionKey?: string;
    itemType?: string;
    questionCategory?: string;
    topic?: string;
    teachingContent?: string;
  }>,
): FlatStructureQuestion[] {
  const byKey = new Map<string, (typeof labels)[number]>();
  for (const label of labels) {
    const key = textOf(label.questionKey);
    if (key) byKey.set(key, label);
  }
  return rows.map((row) => {
    const label =
      byKey.get(row.questionKey) ||
      byKey.get(formatQuestionKey(row.parentKey, row.partKey));
    if (!label) return row;
    return {
      ...row,
      itemType: textOf(label.itemType) || row.itemType,
      questionCategory: textOf(label.questionCategory) || row.questionCategory,
      topic: textOf(label.topic) || row.topic,
      teachingContent: tidyTeachingContent(textOf(label.teachingContent)) || row.teachingContent,
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
    const kept: FlatStructureQuestion[] = [];
    for (const row of map.get(parent)!) {
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
): FlatStructureQuestion[] {
  const parent = incoming[0]?.parentKey;
  if (!parent || incoming.every((row) => !row.partKey.trim())) return current;
  const byPart = new Map<string, FlatStructureQuestion>();
  for (const row of current) {
    if (row.parentKey === parent) byPart.set(row.partKey, row);
  }
  for (const row of incoming) {
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
  return {
    questionKey: formatQuestionKey(parentKey, partKey),
    parentKey,
    partKey,
    stem: textOf(value.stem),
    prompt: textOf(value.prompt),
    topic: textOf(value.topic) || "—",
    itemType: textOf(value.itemType) || "short",
    questionCategory: textOf(value.questionCategory),
    maxScore: marks(value.maxScore, 1),
    assessmentObjective: textOf(value.assessmentObjective),
    difficultyPoints: textOf(value.difficultyPoints),
    teachingContent: textOf(value.teachingContent),
  };
}
