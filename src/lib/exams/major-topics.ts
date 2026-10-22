export type MajorTopicLocale = "en" | "zh-HK";

type MajorTopic = {
  zh: string;
  en: string;
  aliases: string[];
};

/**
 * Top-level topics in the Physics Curriculum and Assessment Guide
 * (compulsory part, then elective part). Finer labels such as
 * "Thermodynamics" or "Optics" roll up to these.
 */
const MAJOR_TOPICS: MajorTopic[] = [
  {
    zh: "熱和氣體",
    en: "Heat and Gases",
    aliases: ["熱和氣體", "熱與氣體", "熱力學", "氣體", "熱", "heat and gases", "thermodynamics", "heat", "gases", "gas"],
  },
  {
    zh: "力和運動",
    en: "Force and Motion",
    aliases: ["力和運動", "力與運動", "力", "運動", "force and motion", "mechanics", "force", "motion"],
  },
  {
    zh: "波動",
    en: "Wave Motion",
    aliases: ["波動", "光學", "波", "wave motion", "waves", "wave", "optics", "light", "sound"],
  },
  {
    zh: "電和磁",
    en: "Electricity and Magnetism",
    aliases: [
      "電和磁",
      "電力和磁力",
      "電磁感應",
      "電力學",
      "電力",
      "磁力",
      "電磁",
      "電",
      "磁",
      "electricity and magnetism",
      "electromagnetic induction",
      "electromagnetism",
      "electrodynamics",
      "electrostatics",
      "electricity",
      "magnetism",
    ],
  },
  {
    zh: "放射和核能",
    en: "Radioactivity and Nuclear Energy",
    aliases: [
      "放射和核能",
      "放射及核能",
      "放射性與核能",
      "放射性和核能",
      "放射",
      "核能",
      "radioactivity and nuclear energy",
      "radioactivity",
      "nuclear",
    ],
  },
  {
    zh: "天文學和航天科學",
    en: "Astronomy and Space Science",
    aliases: ["天文學和航天科學", "天文", "航天", "astronomy and space science", "astronomy", "space science"],
  },
  {
    zh: "原子世界",
    en: "Atomic World",
    aliases: ["原子世界", "原子", "atomic world", "photoelectric", "rutherford", "bohr"],
  },
  {
    zh: "能量和能源的使用",
    en: "Energy and Use of Energy",
    aliases: ["能量和能源的使用", "能源", "energy and use of energy", "renewable", "energy efficiency"],
  },
  {
    zh: "醫學物理學",
    en: "Medical Physics",
    aliases: ["醫學物理學", "醫學物理", "medical physics", "medical imaging"],
  },
];

function aliasMatches(source: string, alias: string): boolean {
  const hay = source.trim().toLowerCase();
  const needle = alias.trim().toLowerCase();
  if (!hay || !needle) return false;
  if (/[\u4e00-\u9fff]/.test(needle)) return hay.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(hay);
}

/** Roll a stored topic up to a syllabus major topic. Unrecognised names stay as written. */
export function majorTopicLabel(
  topic: { topic?: string; topicZh?: string; topicEn?: string },
  locale: MajorTopicLocale,
): string {
  const sources = [topic.topicZh, topic.topicEn, topic.topic]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  let best: { major: MajorTopic; length: number } | null = null;
  for (const major of MAJOR_TOPICS) {
    for (const alias of major.aliases) {
      if (!sources.some((source) => aliasMatches(source, alias))) continue;
      if (!best || alias.length > best.length) best = { major, length: alias.length };
    }
  }
  if (best) return locale === "en" ? best.major.en : best.major.zh;
  const zh = topic.topicZh?.trim() ?? "";
  const en = topic.topicEn?.trim() ?? "";
  const stored = topic.topic?.trim() ?? "";
  if (locale === "en") return en || stored || zh;
  return zh || stored || en;
}
