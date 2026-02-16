export type ValidationError = {
    code: string;
    message: string;
    path?: string;
};

export const PREVIEW_VALIDATION_ERROR_CODE = {
    DEV_EXPORT_INVALID: 'DEV_EXPORT_INVALID',
    ADAPTER_FAILED: 'ADAPTER_FAILED',
    SAVED_RECORD_INVALID: 'SAVED_RECORD_INVALID',
} as const;

export function createValidationError(code: string, message: string, path?: string): ValidationError {
    return { code, message, path };
}
