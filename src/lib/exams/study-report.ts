/**
 * Per-question revision report produced when a student script is scored.
 * Chinese (Hong Kong) and English are stored separately so the report
 * follows the student's locale.
 */

export type StudyReportFields = {
  didWellZh: string;
  didWellEn: string;
  weaknessZh: string;
  weaknessEn: string;
  mistakesToWatchZh: string;
  mistakesToWatchEn: string;
  howToImproveZh: string;
  howToImproveEn: string;
};

export type ScoredQuestion = StudyReportFields & {
  questionKey: string;
  topic: string;
  itemType: string;
  score: number;
  maxScore: number;
  feedback?: string;
};

export type ParsedSubmissionScores = {
  studyFocusZh: string;
  studyFocusEn: string;
  scores: ScoredQuestion[];
};

type ExpectedQuestion = {
  questionKey: string;
  topic: string;
  itemType: string;
  maxScore: number;
  topicZh?: string;
  topicEn?: string;
  assessmentObjective?: string;
  assessmentObjectiveZh?: string;
  assessmentObjectiveEn?: string;
  difficultyPoints?: string;
  difficultyPointsZh?: string;
  difficultyPointsEn?: string;
};

const FIELD_ALIASES = {
  didWell: ["didWell", "strengths", "strength", "whatWentWell", "goodPoints"],
  weakness: ["weakness", "weaknesses", "didPoorly", "gaps", "weakPoint"],
  mistakesToWatch: ["mistakesToWatch", "mistakes", "carefulAbout", "errorsToAvoid", "watchOut"],
  howToImprove: ["howToImprove", "improvement", "improvements", "revisionSteps", "howToRevise"],
} as const;

export const EMPTY_STUDY_REPORT: StudyReportFields = {
  didWellZh: "",
  didWellEn: "",
  weaknessZh: "",
  weaknessEn: "",
  mistakesToWatchZh: "",
  mistakesToWatchEn: "",
  howToImproveZh: "",
  howToImproveEn: "",
};

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function placeByScript(text: string): { zh: string; en: string } {
  if (!text) return { zh: "", en: "" };
  return hasCjk(text) ? { zh: text, en: "" } : { zh: "", en: text };
}

function joinSide(parts: Array<{ zh: string; en: string }>, side: "zh" | "en"): string {
  return parts
    .map((part) => part[side])
    .filter(Boolean)
    .join("\n");
}

/** Read Traditional Chinese (Hong Kong) and English from a string, object, or list. */
export function readBilingual(value: unknown): { zh: string; en: string } {
  if (Array.isArray(value)) {
    const parts = value.map((item) => readBilingual(item));
    return { zh: joinSide(parts, "zh"), en: joinSide(parts, "en") };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const zh = textOf(record.zh ?? record.zhHk ?? record["zh-HK"] ?? record.zh_hk);
    const en = textOf(record.en ?? record.english);
    if (zh || en) return { zh, en };
    const text = textOf(record.text ?? record.content);
    return placeByScript(text);
  }
  return placeByScript(textOf(value));
}

function readField(source: Record<string, unknown>, names: readonly string[]): { zh: string; en: string } {
  for (const name of names) {
    const explicitZh = textOf(source[`${name}Zh`]);
    const explicitEn = textOf(source[`${name}En`]);
    if (explicitZh || explicitEn) return { zh: explicitZh, en: explicitEn };
    const value = source[name];
    if (value != null && value !== "") return readBilingual(value);
  }
  return { zh: "", en: "" };
}

export function readStudyReport(source: Record<string, unknown>): StudyReportFields {
  const didWell = readField(source, FIELD_ALIASES.didWell);
  const weakness = readField(source, FIELD_ALIASES.weakness);
  const mistakesToWatch = readField(source, FIELD_ALIASES.mistakesToWatch);
  const howToImprove = readField(source, FIELD_ALIASES.howToImprove);
  return {
    didWellZh: didWell.zh,
    didWellEn: didWell.en,
    weaknessZh: weakness.zh,
    weaknessEn: weakness.en,
    mistakesToWatchZh: mistakesToWatch.zh,
    mistakesToWatchEn: mistakesToWatch.en,
    howToImproveZh: howToImprove.zh,
    howToImproveEn: howToImprove.en,
  };
}

function finiteScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Clamp a per-question mark into [0, maxScore]. */
export function clampQuestionScore(score: number, maxScore: number): number {
  const ceiling = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 0;
  const raw = Number.isFinite(score) ? score : 0;
  return Math.min(ceiling, Math.max(0, raw));
}

/** Clamp an overall mark ratio into [0, 1] (0%–100%). */
export function clampScoreRatio(score: number, maxScore: number): number {
  if (!(maxScore > 0) || !Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score / maxScore));
}

export function parseSubmissionScorePayload(
  payload: unknown,
  questions: ExpectedQuestion[],
): ParsedSubmissionScores {
  const root =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const focus = readField(root, ["studyFocus", "revisionPlan", "overallFocus"]);
  const rawScores = Array.isArray(root.scores) ? root.scores : [];
  const byKey = new Map(questions.map((question) => [question.questionKey, question]));
  const scores: ScoredQuestion[] = [];

  for (const item of rawScores) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const questionKey = textOf(record.questionKey || record.key);
    const question = byKey.get(questionKey);
    if (!question) continue;
    const feedback = textOf(record.feedback);
    const maxScore =
      question.maxScore > 0 ? question.maxScore : Math.max(0, finiteScore(record.maxScore));
    scores.push({
      questionKey: question.questionKey,
      topic: textOf(record.topic) || question.topic,
      itemType: textOf(record.itemType) || question.itemType,
      score: clampQuestionScore(finiteScore(record.score), maxScore),
      maxScore,
      ...(feedback ? { feedback } : {}),
      ...readStudyReport(record),
    });
  }

  return {
    studyFocusZh: focus.zh,
    studyFocusEn: focus.en,
    scores,
  };
}

function clip(text: string, fallback: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

/**
 * Offline scores that still show a full revision report for every question.
 * Used when the analysis key is absent and demo mode is on.
 */
export function buildDemoStudyReport(questions: ExpectedQuestion[]): ParsedSubmissionScores {
  const list = questions.length > 0 ? questions : [];
  const scores = list.map((question, index) => {
    const lost = index % 3;
    const score = Math.max(0, question.maxScore - lost);
    const topicZh = clip(question.topicZh || "", hasCjk(question.topic) ? question.topic : "這一課題");
    const topicEn = clip(question.topicEn || "", hasCjk(question.topic) ? "this topic" : question.topic || "this topic");
    const objectiveZh = clip(
      question.assessmentObjectiveZh || "",
      hasCjk(question.assessmentObjective || "") ? question.assessmentObjective || "" : "題目要求的概念與步驟",
    );
    const objectiveEn = clip(
      question.assessmentObjectiveEn || "",
      hasCjk(question.assessmentObjective || "") ? "the idea and steps this question assesses" : question.assessmentObjective || "the idea and steps this question assesses",
    );
    const hardZh = clip(
      question.difficultyPointsZh || "",
      hasCjk(question.difficultyPoints || "") ? question.difficultyPoints || "" : "單位、符號，以及沒有寫出理由",
    );
    const hardEn = clip(
      question.difficultyPointsEn || "",
      hasCjk(question.difficultyPoints || "") ? "units, signs, and missing reasons" : question.difficultyPoints || "units, signs, and missing reasons",
    );
    const key = question.questionKey;

    if (lost === 0) {
      return {
        questionKey: key,
        topic: question.topic,
        itemType: question.itemType,
        score,
        maxScore: question.maxScore,
        feedback: `第 ${key} 題步驟完整。`,
        didWellZh: `第 ${key} 題的步驟完整，答案對應「${objectiveZh}」。`,
        didWellEn: `Question ${key} has complete working, and the answer meets “${objectiveEn}”.`,
        weaknessZh: "這題沒有失分，但解釋仍可寫明「為什麼這樣做」，而不只寫最後結果。",
        weaknessEn: "No marks were lost, but the reason for each step could be clearer than the final result alone.",
        mistakesToWatchZh: `即使答案正確，仍要留意：${hardZh}。相似題不要漏寫這些檢查。`,
        mistakesToWatchEn: `Even with a correct answer, keep watching: ${hardEn}. Do not skip those checks on a similar question.`,
        howToImproveZh: `把第 ${key} 題的正確步驟抄一次，每步旁寫原因。\n另找一題${topicZh}，限時重做。\n對答案時先核對單位和符號，再核對數值。`,
        howToImproveEn: `Copy the correct steps for question ${key} and write the reason beside each step.\nSet a time limit and redo one more ${topicEn} question.\nWhen you check, look at units and signs before the number.`,
      };
    }

    if (lost === 1) {
      return {
        questionKey: key,
        topic: question.topic,
        itemType: question.itemType,
        score,
        maxScore: question.maxScore,
        feedback: `第 ${key} 題只取得部分分數。`,
        didWellZh: `你已掌握${topicZh}的部分方法，第 ${key} 題開首方向正確。`,
        didWellEn: `You already have part of the method for ${topicEn}. The opening of question ${key} points the right way.`,
        weaknessZh: `未能完整達到「${objectiveZh}」：中段推導斷開，所以只取得部分分數。`,
        weaknessEn: `The answer does not fully meet “${objectiveEn}”: the middle of the working breaks off, so only part of the marks were awarded.`,
        mistakesToWatchZh: `下次先列出已知與未知，再檢查：${hardZh}。`,
        mistakesToWatchEn: `Next time, list what is known and what is unknown, then check: ${hardEn}.`,
        howToImproveZh: `用筆圈出第 ${key} 題中斷的一步，只重寫正確的下一步，不要整題抄答案。\n重做後用自己的話講一次這題在考什麼。\n第二天不看筆記再做同一類型。`,
        howToImproveEn: `Circle the step where question ${key} stopped and rewrite only the next correct step. Do not copy the whole answer.\nThen say in your own words what the question is testing.\nThe next day, redo the same type without notes.`,
      };
    }

    return {
      questionKey: key,
      topic: question.topic,
      itemType: question.itemType,
      score,
      maxScore: question.maxScore,
      feedback: `第 ${key} 題失分較多，需要先重修概念。`,
      didWellZh: `你有嘗試作答第 ${key} 題，卷面上看得到起點。`,
      didWellEn: `You did attempt question ${key}; the script shows a starting point.`,
      weaknessZh: `${topicZh}的主要概念尚未穩定，答案未能對應「${objectiveZh}」，所以失分較多。`,
      weaknessEn: `The main idea in ${topicEn} is not secure yet. The answer does not match “${objectiveEn}”, so many marks were lost.`,
      mistakesToWatchZh: `不要只寫一個數字。要寫公式、代入和單位，並特別小心：${hardZh}。`,
      mistakesToWatchEn: `Do not write only a number. Show the formula, the substitution, and the unit, and be especially careful about: ${hardEn}.`,
      howToImproveZh: `先用一行寫下${topicZh}的定義或公式。\n看着正確步驟，遮住答案，重做第 ${key} 題一次。\n第二天不看筆記再做；錯了才對照上面要小心的地方。`,
      howToImproveEn: `Write the definition or formula for ${topicEn} in one line.\nCover the answer, follow a correct solution, and redo question ${key} once.\nThe next day, try again without notes, and only then compare the mistakes listed above.`,
    };
  });

  const weak = scores.filter((row) => row.maxScore > 0 && row.score / row.maxScore < 0.75);
  const weakTopics = [...new Set(weak.map((row) => row.topic))].slice(0, 3);
  const topicListZh = weakTopics.length > 0 ? weakTopics.join("、") : "今次沒有明顯失分課題";
  const topicListEn = weakTopics.length > 0 ? weakTopics.join(", ") : "no topic lost a large share of marks";

  return {
    studyFocusZh: `溫習次序：先重做失分最多的題目，把每一題「要小心的錯誤」抄到筆記，再按「如何改善」各做一次。優先課題：${topicListZh}。`,
    studyFocusEn: `Revise in this order: redo the questions that lost the most marks, copy each “mistakes to watch” note, then follow “how to improve” once per question. Start with: ${topicListEn}.`,
    scores,
  };
}
