/**
 * Every system prompt the app sends to the analysis model.
 * Admins edit these per school; missing rows use the built-in defaults.
 */

import { prisma } from "@/lib/prisma";

export const SYSTEM_PROMPT_KEYS = ["exam_structure", "submission_scoring"] as const;

export type SystemPromptKey = (typeof SYSTEM_PROMPT_KEYS)[number];

export const SYSTEM_PROMPT_MAX_LENGTH = 16_000;

const EXAM_STRUCTURE_SCHEMA = `{
  "questions": [
    {
      "questionKey": "string",
      "topic": "string",
      "itemType": "string",
      "questionCategory": "string",
      "maxScore": "number",
      "assessmentObjective": "string",
      "difficultyPoints": "string"
    }
  ]
}`;

const SUBMISSION_SCORING_SCHEMA = `{
  "scores": [
    {
      "questionKey": "string",
      "topic": "string",
      "itemType": "string",
      "score": "number",
      "maxScore": "number",
      "feedback": "string"
    }
  ]
}`;

/** Instruction text only. Required JSON lives in DEFAULT_OUTPUT_SCHEMAS. */
export const DEFAULT_SYSTEM_PROMPT_BODIES: Record<SystemPromptKey, string> = {
  exam_structure:
    "You are an experienced Hong Kong secondary-school exam analyst. " +
    "Analyze EVERY question on the paper. " +
    "Rules: (1) One object per question / numbered part (e.g. 1a, 1b) when marks differ. " +
    "(2) itemType = 題型, examples: mcq, short, essay, calculation. " +
    "(3) questionCategory = 題目種類 from the syllabus when provided (e.g. 概念、應用、實驗、數據分析); otherwise infer from the paper. " +
    "(4) assessmentObjective = 考核要求 — the skill or learning outcome this item assesses. " +
    "(5) difficultyPoints = 難點 — key hard points, traps, or common student mistakes. " +
    "(6) If a SYLLABUS asset is attached, use its topics, outcomes, and wording to classify 題型, 題目種類, 考核要求, and 難點. Do not invent requirements that contradict the syllabus. If no syllabus is attached, infer from the paper only. " +
    "(7) Write questionCategory, assessmentObjective, and difficultyPoints in Traditional Chinese (Hong Kong) " +
    "if the paper or syllabus is Chinese; otherwise match that language. Be concrete, 1–3 sentences for 考核要求 and 難點. " +
    "(8) No markdown.",
  submission_scoring:
    "You score a student exam script. " +
    "Use the provided question list. When assessmentObjective / difficultyPoints are present, " +
    "judge whether the student met the objective and whether they stumbled on the hard points; " +
    "reflect that briefly in feedback (Traditional Chinese Hong Kong if the script is Chinese). No markdown.",
};

export const DEFAULT_OUTPUT_SCHEMAS: Record<SystemPromptKey, string> = {
  exam_structure: EXAM_STRUCTURE_SCHEMA,
  submission_scoring: SUBMISSION_SCORING_SCHEMA,
};

/** Full prompt sent to the model: instructions plus the required JSON shape. */
export const DEFAULT_SYSTEM_PROMPTS: Record<SystemPromptKey, string> = {
  exam_structure: composeSystemPrompt(
    DEFAULT_SYSTEM_PROMPT_BODIES.exam_structure,
    DEFAULT_OUTPUT_SCHEMAS.exam_structure,
  ),
  submission_scoring: composeSystemPrompt(
    DEFAULT_SYSTEM_PROMPT_BODIES.submission_scoring,
    DEFAULT_OUTPUT_SCHEMAS.submission_scoring,
  ),
};

/** What the improver must keep intact for each prompt. Not shown as the prompt itself. */
export const SYSTEM_PROMPT_CONTRACTS: Record<SystemPromptKey, string> = {
  exam_structure:
    "Extract exam question structure from a question paper, optional answer key, and optional syllabus. " +
    'The model must reply with JSON only: {"questions":[{"questionKey":"string","topic":"string","itemType":"string","questionCategory":"string","maxScore":number,"assessmentObjective":"string","difficultyPoints":"string"}]}. ' +
    "itemType is the question format. questionCategory, assessmentObjective, and difficultyPoints are required outputs.",
  submission_scoring:
    "Score a student script against a known question list. " +
    'The model must reply with JSON only: {"scores":[{"questionKey":"string","topic":"string","itemType":"string","score":number,"maxScore":number,"feedback":"string"}]}. ' +
    "Feedback should say whether the student met the assessment objective and the hard points.",
};

export type SystemPromptDto = {
  key: SystemPromptKey;
  body: string;
  outputSchema: string;
};

/** Instructions plus the required JSON the model must return. */
export function composeSystemPrompt(body: string, outputSchema: string): string {
  return `${body.trim()}\n\nReply with JSON only:\n${outputSchema.trim()}`;
}

/** Pull a JSON object out of an older prompt that embedded the schema in the text. */
export function splitEmbeddedOutputSchema(
  key: SystemPromptKey,
  storedBody: string,
): { body: string; outputSchema: string } {
  const start = storedBody.indexOf("{");
  const end = storedBody.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return {
      body: storedBody.trim() || DEFAULT_SYSTEM_PROMPT_BODIES[key],
      outputSchema: DEFAULT_OUTPUT_SCHEMAS[key],
    };
  }
  const raw = storedBody.slice(start, end + 1);
  const before = storedBody.slice(0, start).replace(/Reply with JSON only:\s*$/i, "").trim();
  const after = storedBody
    .slice(end + 1)
    .replace(/^\s*\.\s*/, "")
    .trim();
  const body = [before, after].filter(Boolean).join(" ").trim();
  return {
    body: body || DEFAULT_SYSTEM_PROMPT_BODIES[key],
    outputSchema: prettyOutputSchema(raw) || DEFAULT_OUTPUT_SCHEMAS[key],
  };
}

function prettyOutputSchema(raw: string): string | null {
  const normalized = raw.replace(/:\s*number\b/g, ': "number"');
  try {
    return JSON.stringify(JSON.parse(normalized), null, 2);
  } catch {
    return raw.trim() || null;
  }
}

export function isSystemPromptKey(value: string): value is SystemPromptKey {
  return (SYSTEM_PROMPT_KEYS as readonly string[]).includes(value);
}

export function assertSystemPromptBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("system prompt is empty");
  }
  if (trimmed.length > SYSTEM_PROMPT_MAX_LENGTH) {
    throw new Error("system prompt is too long");
  }
  return trimmed;
}

export function assertOutputSchema(schema: string): string {
  const trimmed = schema.trim();
  if (!trimmed) {
    throw new Error("output schema is empty");
  }
  if (trimmed.length > SYSTEM_PROMPT_MAX_LENGTH) {
    throw new Error("output schema is too long");
  }
  const pretty = prettyOutputSchema(trimmed);
  if (!pretty || !pretty.startsWith("{")) {
    throw new Error("output schema must be a JSON object");
  }
  return pretty;
}

export async function listSystemPrompts(schoolId: string): Promise<SystemPromptDto[]> {
  const rows = await prisma.systemPrompt.findMany({
    where: { schoolId },
    select: { key: true, body: true, outputSchema: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return SYSTEM_PROMPT_KEYS.map((key) => {
    const row = byKey.get(key);
    if (!row?.body.trim()) {
      return {
        key,
        body: DEFAULT_SYSTEM_PROMPT_BODIES[key],
        outputSchema: DEFAULT_OUTPUT_SCHEMAS[key],
      };
    }
    if (row.outputSchema?.trim()) {
      return {
        key,
        body: row.body.trim(),
        outputSchema: row.outputSchema.trim(),
      };
    }
    return { key, ...splitEmbeddedOutputSchema(key, row.body) };
  });
}

export async function resolveSystemPrompt(
  schoolId: string,
  key: SystemPromptKey,
): Promise<string> {
  try {
    const row = await prisma.systemPrompt.findUnique({
      where: { schoolId_key: { schoolId, key } },
      select: { body: true, outputSchema: true },
    });
    const body = row?.body.trim();
    if (body) {
      const outputSchema = row?.outputSchema?.trim();
      if (outputSchema) return composeSystemPrompt(body, outputSchema);
      const split = splitEmbeddedOutputSchema(key, body);
      return composeSystemPrompt(split.body, split.outputSchema);
    }
  } catch {
    // Missing table or offline DB — keep analysis on the built-in prompt.
  }
  return DEFAULT_SYSTEM_PROMPTS[key];
}

export async function saveSystemPrompts(
  schoolId: string,
  prompts: SystemPromptDto[],
): Promise<SystemPromptDto[]> {
  const byKey = new Map<SystemPromptKey, { body: string; outputSchema: string }>();
  for (const prompt of prompts) {
    if (!isSystemPromptKey(prompt.key)) {
      throw new Error("unknown system prompt");
    }
    byKey.set(prompt.key, {
      body: assertSystemPromptBody(prompt.body),
      outputSchema: assertOutputSchema(prompt.outputSchema),
    });
  }
  for (const key of SYSTEM_PROMPT_KEYS) {
    if (!byKey.has(key)) {
      throw new Error("missing system prompt");
    }
  }

  await prisma.$transaction(
    SYSTEM_PROMPT_KEYS.map((key) => {
      const value = byKey.get(key)!;
      return prisma.systemPrompt.upsert({
        where: { schoolId_key: { schoolId, key } },
        create: { schoolId, key, body: value.body, outputSchema: value.outputSchema },
        update: { body: value.body, outputSchema: value.outputSchema },
      });
    }),
  );

  return SYSTEM_PROMPT_KEYS.map((key) => {
    const value = byKey.get(key)!;
    return { key, body: value.body, outputSchema: value.outputSchema };
  });
}
