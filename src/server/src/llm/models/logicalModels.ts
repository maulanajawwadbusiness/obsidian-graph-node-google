export type LogicalModel = "gpt-5.2" | "gpt-5.1" | "gpt-5-mini" | "gpt-5-nano";

export const DEFAULT_LOGICAL_MODELS = {
  chat: "gpt-5.1" as LogicalModel,
  analyze: "gpt-5.2" as LogicalModel,
  prefill: "gpt-5-nano" as LogicalModel
} as const;
