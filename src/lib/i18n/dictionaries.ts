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
      "Create school settings and teacher accounts here. Teaching workspace is separate.",
    emptyTeacher:
      "TODO (next knife): exam upload + analysis job. Empty shell for now.",
    emptyStudent: "TODO: own submissions & weak-point view. Empty shell for now.",
    settingsTitle: "School settings",
    settingsIntro:
      "Configure this school once. Analysis model choices come from the allowlist; API keys stay in environment variables only.",
    settingsSectionSchool: "School profile",
    settingsSectionYear: "Default school year",
    settingsSectionModel: "Analysis model",
    settingsSectionPermissions: "Teacher permissions",
    settingsSectionTeachers: "Teacher accounts",
    settingsFieldDisplayName: "School display name",
    settingsFieldContact: "Contact note (optional)",
    settingsFieldYear: "Default school year",
    settingsFieldYearPlaceholder: "Select a school year",
    settingsFieldYearCreateLabel: "Add school year",
    settingsFieldYearName: "Year name (e.g. 2026-2027)",
    settingsFieldYearAdd: "Add year",
    settingsFieldModel: "Analysis model",
    settingsFieldModelHelp:
      "Only allowlisted models appear here. Changing the model affects new analysis jobs only; past results keep their stored model id.",
    settingsFieldTeacherStudents: "Allow teachers to create student accounts",
    settingsFieldTeacherUpload: "Allow teachers to upload on behalf of students",
    settingsTeachersIntro:
      "Create teacher accounts for this school. New teachers use the stub password “password” until real auth is wired.",
    settingsTeacherName: "Teacher name",
    settingsTeacherEmail: "Teacher email",
    settingsTeacherCreate: "Create teacher",
    settingsTeacherEmpty: "No teachers yet for this school.",
    settingsTeacherList: "Teachers",
    settingsSave: "Save settings",
    settingsSaving: "Saving…",
    settingsLoading: "Loading school settings…",
    settingsEmpty:
      "No settings found yet. Fill in the form below and save to create them.",
    settingsErrorLoad: "Could not load school settings.",
    settingsErrorSave: "Could not save school settings.",
    settingsErrorTeacher: "Could not create teacher.",
    settingsErrorYear: "Could not add school year.",
    settingsSuccess: "Settings saved.",
    settingsTeacherSuccess: "Teacher created.",
    settingsYearSuccess: "School year added.",
    settingsRetry: "Retry",
    backAdmin: "Back to admin",
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
    emptyAdmin: "可在此管理學校設定與教師帳戶；教學工作區為獨立範圍。",
    emptyTeacher: "TODO（下一刀）：試卷上載與分析工作。目前為空殼。",
    emptyStudent: "TODO：個人呈交與弱項檢視。目前為空殼。",
    settingsTitle: "學校設定",
    settingsIntro:
      "一次設定此學校。分析模型只可從允許清單選擇；API 金鑰只存放於環境變數。",
    settingsSectionSchool: "學校資料",
    settingsSectionYear: "預設學年",
    settingsSectionModel: "分析模型",
    settingsSectionPermissions: "教師權限",
    settingsSectionTeachers: "教師帳戶",
    settingsFieldDisplayName: "學校顯示名稱",
    settingsFieldContact: "聯絡備註（可選）",
    settingsFieldYear: "預設學年",
    settingsFieldYearPlaceholder: "選擇學年",
    settingsFieldYearCreateLabel: "新增學年",
    settingsFieldYearName: "學年名稱（例如 2026-2027）",
    settingsFieldYearAdd: "新增學年",
    settingsFieldModel: "分析模型",
    settingsFieldModelHelp:
      "只顯示允許清單內的模型。更改模型只影響新分析工作；過往結果保留已儲存的模型 id。",
    settingsFieldTeacherStudents: "允許教師建立學生帳戶",
    settingsFieldTeacherUpload: "允許教師代學生上載呈交",
    settingsTeachersIntro:
      "為此學校建立教師帳戶。新教師暫時使用 stub 密碼 password，直至正式認證接上。",
    settingsTeacherName: "教師姓名",
    settingsTeacherEmail: "教師電郵",
    settingsTeacherCreate: "建立教師",
    settingsTeacherEmpty: "此學校尚未有教師。",
    settingsTeacherList: "教師名單",
    settingsSave: "儲存設定",
    settingsSaving: "儲存中…",
    settingsLoading: "正在載入學校設定…",
    settingsEmpty: "尚未有設定。請填寫以下表單並儲存以建立。",
    settingsErrorLoad: "無法載入學校設定。",
    settingsErrorSave: "無法儲存學校設定。",
    settingsErrorTeacher: "無法建立教師。",
    settingsErrorYear: "無法新增學年。",
    settingsSuccess: "設定已儲存。",
    settingsTeacherSuccess: "已建立教師。",
    settingsYearSuccess: "已新增學年。",
    settingsRetry: "重試",
    backAdmin: "返回管理員",
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
