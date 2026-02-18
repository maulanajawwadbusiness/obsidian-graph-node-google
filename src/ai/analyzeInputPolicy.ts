import {
    ANALYZE_INPUT_POLICY,
    type AnalyzeInputPolicy
} from '../config/analyzeInputPolicy';

export type AnalyzeInputPolicyResult = {
    text: string;
    originalLength: number;
    finalLength: number;
    truncationApplied: boolean;
    maxChars: number;
};

export function applyAnalyzeInputPolicy(
    text: string,
    policy: AnalyzeInputPolicy = ANALYZE_INPUT_POLICY
): AnalyzeInputPolicyResult {
    const originalLength = text.length;
    if (!policy.enableTruncation) {
        return {
            text,
            originalLength,
            finalLength: originalLength,
            truncationApplied: false,
            maxChars: policy.maxChars
        };
    }

    const truncatedText = text.slice(0, policy.maxChars);
    return {
        text: truncatedText,
        originalLength,
        finalLength: truncatedText.length,
        truncationApplied: truncatedText.length !== originalLength,
        maxChars: policy.maxChars
    };
}
