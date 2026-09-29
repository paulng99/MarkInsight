"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { SystemPromptKey } from "@/lib/llm/system-prompts";
import type {
  AnalysisModelChoiceDto,
  SystemPromptSettingDto,
} from "@/lib/school-settings/types";

const PROMPT_FIELDS: Array<{
  key: SystemPromptKey;
  title: "settingsPromptExamStructure" | "settingsPromptScoring";
  help: "settingsPromptExamStructureHelp" | "settingsPromptScoringHelp";
}> = [
  {
    key: "exam_structure",
    title: "settingsPromptExamStructure",
    help: "settingsPromptExamStructureHelp",
  },
  {
    key: "submission_scoring",
    title: "settingsPromptScoring",
    help: "settingsPromptScoringHelp",
  },
];

type Props = {
  locale: Locale;
  t: Dictionary;
  schoolId: string;
  initialPrompts: SystemPromptSettingDto[];
  initialAnalysisLlmModel: string;
  initialModelChoices: AnalysisModelChoiceDto[];
};

type PromptDraft = { body: string; outputSchema: string };

function toMap(prompts: SystemPromptSettingDto[]): Record<SystemPromptKey, PromptDraft> {
  const map: Record<SystemPromptKey, PromptDraft> = {
    exam_structure: { body: "", outputSchema: "" },
    submission_scoring: { body: "", outputSchema: "" },
  };
  for (const prompt of prompts) {
    map[prompt.key] = { body: prompt.body, outputSchema: prompt.outputSchema };
  }
  return map;
}

function withCurrentModel(
  choices: AnalysisModelChoiceDto[],
  currentId: string,
): AnalysisModelChoiceDto[] {
  if (!currentId || choices.some((m) => m.id === currentId)) return choices;
  return [
    {
      id: currentId,
      name: currentId,
      supportsFile: true,
      supportsImage: true,
    },
    ...choices,
  ];
}

export function SystemPromptsForm({
  locale,
  t,
  schoolId,
  initialPrompts,
  initialAnalysisLlmModel,
  initialModelChoices,
}: Props) {
  const [prompts, setPrompts] = useState(() => toMap(initialPrompts));
  const [analysisLlmModel, setAnalysisLlmModel] = useState(initialAnalysisLlmModel);
  const [modelChoices] = useState(() =>
    withCurrentModel(initialModelChoices, initialAnalysisLlmModel),
  );
  const [modelQuery, setModelQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [improvingKey, setImprovingKey] = useState<SystemPromptKey | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return modelChoices;
    return modelChoices.filter(
      (m) =>
        m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [modelChoices, modelQuery]);

  async function onSave(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setSaving(true);
    setBanner(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/system-prompts", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          analysisLlmModel,
          systemPrompts: PROMPT_FIELDS.map((item) => ({
            key: item.key,
            body: prompts[item.key].body,
            outputSchema: prompts[item.key].outputSchema,
          })),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        systemPrompts?: SystemPromptSettingDto[];
        analysisLlmModel?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || t.settingsErrorSave);
      }
      if (data.systemPrompts) setPrompts(toMap(data.systemPrompts));
      if (data.analysisLlmModel) setAnalysisLlmModel(data.analysisLlmModel);
      setBanner(t.settingsSuccess);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.settingsErrorSave);
    } finally {
      setSaving(false);
    }
  }

  async function onImprovePrompt(key: SystemPromptKey) {
    const draft = prompts[key].body.trim();
    if (!draft) {
      setErrorMessage(t.settingsPromptImproveEmpty);
      return;
    }
    setImprovingKey(key);
    setBanner(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/system-prompts/improve", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, key, draft }),
      });
      const data = (await res.json()) as { error?: string; prompt?: string };
      if (!res.ok || !data.prompt) {
        throw new Error(data.error || t.settingsPromptImproveError);
      }
      setPrompts((current) => ({
        ...current,
        [key]: { ...current[key], body: data.prompt! },
      }));
      setBanner(t.settingsPromptImproved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.settingsPromptImproveError);
    } finally {
      setImprovingKey(null);
    }
  }

  const selectedModel = modelChoices.find((m) => m.id === analysisLlmModel);

  return (
    <form onSubmit={onSave} className="mt-8 space-y-6">
      <span className="sr-only">locale {locale}</span>
      {banner ? <Alert tone="success">{banner}</Alert> : null}
      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="card card-pad">
        <div className="flex items-start gap-3">
          <span
            className="icon-tile"
            style={{ ["--tile-bg" as string]: "#e3f6f3", ["--tile-fg" as string]: "var(--teal-600)" }}
          >
            <Icon.Settings size={18} />
          </span>
          <div>
            <h2 className="section-title">{t.settingsSectionModel}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
              {t.settingsFieldModelHelp}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <label className="label" htmlFor="model-search">
            {t.settingsFieldModelSearch}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]">
              <Icon.Search size={16} />
            </span>
            <input
              id="model-search"
              type="search"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder={t.settingsFieldModelSearchPlaceholder}
              className="input pr-10 pl-10"
              autoComplete="off"
              disabled={saving || improvingKey !== null}
              aria-controls="analysis-model"
            />
            {modelQuery ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                aria-label={t.settingsFieldModelSearch}
                onClick={() => setModelQuery("")}
              >
                <Icon.X size={14} />
              </button>
            ) : null}
          </div>

          {selectedModel && !filteredModels.some((m) => m.id === analysisLlmModel) ? (
            <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
              <span className="font-semibold text-[var(--color-primary)]">
                {t.settingsFieldModelSelected}
              </span>
              {" · "}
              {selectedModel.name === selectedModel.id
                ? selectedModel.id
                : `${selectedModel.name} (${selectedModel.id})`}
            </p>
          ) : null}

          <label className="label" htmlFor="analysis-model">
            {t.settingsFieldModel}
          </label>
          <select
            id="analysis-model"
            value={
              filteredModels.some((m) => m.id === analysisLlmModel)
                ? analysisLlmModel
                : ""
            }
            onChange={(e) => {
              if (e.target.value) setAnalysisLlmModel(e.target.value);
            }}
            className="select font-mono text-sm"
            disabled={saving || improvingKey !== null || filteredModels.length === 0}
          >
            {filteredModels.length === 0 ? (
              <option value="">{t.settingsFieldModelEmpty}</option>
            ) : (
              <>
                {!filteredModels.some((m) => m.id === analysisLlmModel) ? (
                  <option value="">{t.settingsFieldModelPlaceholder}</option>
                ) : null}
                {filteredModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name === model.id
                      ? model.id
                      : `${model.name} (${model.id})`}
                  </option>
                ))}
              </>
            )}
          </select>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {modelQuery.trim()
              ? t.settingsFieldModelFilteredCount
                  .replace("{filtered}", String(filteredModels.length))
                  .replace("{count}", String(modelChoices.length))
              : t.settingsFieldModelCount.replace(
                  "{count}",
                  String(modelChoices.length),
                )}
          </p>
        </div>
      </section>

      <section className="card card-pad">
        <div className="flex items-start gap-3">
          <span
            className="icon-tile"
            style={{ ["--tile-bg" as string]: "#eef4ff", ["--tile-fg" as string]: "#1d4ed8" }}
          >
            <Icon.Sparkles size={18} />
          </span>
          <div>
            <h2 className="section-title">{t.settingsSectionPrompts}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
              {t.settingsSectionPromptsHelp}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {PROMPT_FIELDS.map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between gap-3">
                <label className="label mb-0" htmlFor={`prompt-${item.key}`}>
                  {t[item.title]}
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title={t.settingsPromptImprove}
                  aria-label={t.settingsPromptImprove}
                  disabled={improvingKey !== null || saving || !prompts[item.key].body.trim()}
                  onClick={() => void onImprovePrompt(item.key)}
                >
                  {improvingKey === item.key ? <Icon.Loader size={16} /> : <Icon.Sparkles size={16} />}
                </button>
              </div>
              <textarea
                id={`prompt-${item.key}`}
                required
                rows={8}
                value={prompts[item.key].body}
                disabled={improvingKey === item.key}
                onChange={(e) =>
                  setPrompts((current) => ({
                    ...current,
                    [item.key]: { ...current[item.key], body: e.target.value },
                  }))
                }
                className="textarea mt-2 text-sm leading-relaxed"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{t[item.help]}</p>
              <label className="label mt-4" htmlFor={`schema-${item.key}`}>
                {t.settingsPromptOutputSchema}
              </label>
              <textarea
                id={`schema-${item.key}`}
                required
                rows={8}
                spellCheck={false}
                value={prompts[item.key].outputSchema}
                disabled={improvingKey === item.key}
                onChange={(e) =>
                  setPrompts((current) => ({
                    ...current,
                    [item.key]: { ...current[item.key], outputSchema: e.target.value },
                  }))
                }
                className="textarea mt-2 font-mono text-xs leading-relaxed"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                {t.settingsPromptOutputSchemaHelp}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving || improvingKey !== null || !analysisLlmModel}
            className="btn btn-primary"
          >
            {saving ? <Icon.Loader size={16} /> : <Icon.Check size={16} />}
            {saving ? t.settingsSaving : t.settingsSave}
          </button>
        </div>
      </section>
    </form>
  );
}
