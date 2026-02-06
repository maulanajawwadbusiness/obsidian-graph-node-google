import type { LogicalModel } from "./logicalModels";

const DEFAULT_OPENROUTER_MAP: Record<LogicalModel, string> = {
  "gpt-5.2": "openai/gpt-5.2",
  "gpt-5.1": "openai/gpt-5.1",
  "gpt-5-mini": "openai/gpt-5-mini",
  "gpt-5-nano": "openai/gpt-5-nano"
};

export function mapModel(providerName: "openai" | "openrouter", logicalModel: LogicalModel): string {
  if (providerName === "openrouter") {
    const envKey = `OPENROUTER_MODEL_${logicalModel.replace(/[-.]/g, "_").toUpperCase()}`;
    const override = process.env[envKey];
    return override || DEFAULT_OPENROUTER_MAP[logicalModel];
  }
  return logicalModel;
}
