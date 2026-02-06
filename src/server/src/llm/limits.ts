export const LLM_LIMITS = {
  jsonBodyLimit: "2mb",
  paperAnalyzeTextMax: 80000,
  paperAnalyzeNodeCountMin: 2,
  paperAnalyzeNodeCountMax: 12,
  chatUserPromptMax: 4000,
  chatSystemPromptMax: 8000,
  chatRecentHistoryMax: 20,
  chatMessageMax: 1000,
  chatDocumentTextMax: 3000,
  nodeLabelMax: 200,
  prefillContentMax: 20000,
  prefillMessagesMax: 20
} as const;
