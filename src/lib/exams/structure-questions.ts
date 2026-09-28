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
  "Put every lettered or roman part inside parts (a, b, c, i, ii, iii). Do not skip a part.",
  "stem is the shared wording copied in full from the paper. Each part prompt is that part's wording copied in full. Do not summarise, translate, or shorten the question text.",
  "If a question has no lettered parts, parts is one object with partKey \"\" and prompt equal to the full question.",
  'Put workingNote immediately after questionKey: one short sentence in the paper\'s language describing what you are checking on this question.',
  "part maxScore is that part's mark. The question maxScore is the sum of its parts.",
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
  };
}
