export type Locale = "en" | "zh-HK";

export const locales: Locale[] = ["en", "zh-HK"];

export const defaultLocale: Locale =
  process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "en" ? "en" : "zh-HK";

const dictionaries = {
  en: {
    brand: "MarkInsight",
    tagline: "Exam mark insight for teachers and students",
    supporting:
      "Upload scripts later; this scaffold is the Web MVP shell — roles, schema, and job stubs only.",
    ctaSignIn: "Sign in (dev stub)",
    ctaDocs: "Architecture",
    localeLabel: "Language",
    rolesTitle: "Roles",
    roleAdmin: "Admin — schools & teacher accounts",
    roleTeacher: "Teacher — exams & analysis (coming)",
    roleStudent: "Student — own results (coming)",
    signInTitle: "Dev sign-in",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    signOut: "Sign out",
    demoHint:
      "Use admin@example.com / teacher@example.com / student@example.com with password “password”. No email provider required.",
    adminShell: "Admin shell",
    teacherShell: "Teacher shell",
    studentShell: "Student shell",
    emptyAdmin:
      "TODO: create school + teacher accounts only. No teaching workspace here.",
    emptyTeacher:
      "TODO (knife 1): exam upload + analysis job. Empty shell for now.",
    emptyStudent: "TODO: own submissions & weak-point view. Empty shell for now.",
    unauthorized: "You do not have access to this area.",
    backHome: "Back to home",
  },
  "zh-HK": {
    brand: "MarkInsight",
    tagline: "試卷成績分析 — 協助教師與學生掌握弱項",
    supporting:
      "稍後才會接上試卷上載；此階段只提供 Web MVP 空殼：角色、資料模型與分析工作 stub。",
    ctaSignIn: "登入（開發 stub）",
    ctaDocs: "架構說明",
    localeLabel: "語言",
    rolesTitle: "角色",
    roleAdmin: "管理員 — 只建立學校與教師帳戶",
    roleTeacher: "教師 — 試卷與分析（稍後）",
    roleStudent: "學生 — 個人成績（稍後）",
    signInTitle: "開發用登入",
    email: "電郵",
    password: "密碼",
    submit: "登入",
    signOut: "登出",
    demoHint:
      "請用 admin@example.com / teacher@example.com / student@example.com，密碼皆為 password。無需正式電郵服務。",
    adminShell: "管理員工作區",
    teacherShell: "教師工作區",
    studentShell: "學生工作區",
    emptyAdmin: "TODO：只可建立學校與教師帳戶；此處不是教學工作區。",
    emptyTeacher: "TODO（knife 1）：試卷上載與分析工作。目前為空殼。",
    emptyStudent: "TODO：個人呈交與弱項檢視。目前為空殼。",
    unauthorized: "你沒有權限進入此區。",
    backHome: "返回主頁",
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries["zh-HK"];
}

export function parseLocale(value: string | undefined | null): Locale {
  if (value === "en" || value === "zh-HK") return value;
  return defaultLocale;
}
