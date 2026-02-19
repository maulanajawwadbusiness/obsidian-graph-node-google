export type AnalyzeInputPolicy = {
    enableTruncation: boolean;
    maxChars: number;
};

export const ENABLE_ANALYZE_INPUT_TRUNCATION = true;
export const ANALYZE_INPUT_MAX_CHARS = 6000;

export const ANALYZE_INPUT_POLICY: AnalyzeInputPolicy = {
    enableTruncation: ENABLE_ANALYZE_INPUT_TRUNCATION,
    maxChars: ANALYZE_INPUT_MAX_CHARS
};
