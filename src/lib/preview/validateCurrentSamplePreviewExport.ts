import sampleGraphPreviewExport from '../../samples/sampleGraphPreview.export.json';
import { devExportToSavedInterfaceRecordV1 } from '../devExport/devExportToSavedInterfaceRecord';
import { parseDevInterfaceExportStrict } from '../devExport/parseDevInterfaceExportStrict';
import { parseSavedInterfaceRecordForPreview } from '../devExport/parseSavedInterfaceRecordForPreview';
import { chainResult, ok, type Result } from '../validation/result';
import { validateSampleGraphSemantic } from './validateSampleGraphSemantic';

let hasWarnedInvalidSample = false;

export function validateCurrentSamplePreviewExport(): Result<void> {
    const parsedDevResult = parseDevInterfaceExportStrict(sampleGraphPreviewExport);
    if (!parsedDevResult.ok) return parsedDevResult;

    const adapted = (() => {
        try {
            return ok(devExportToSavedInterfaceRecordV1(parsedDevResult.value, { preview: true }));
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'unknown_adapter_error';
            return {
                ok: false as const,
                errors: [{ code: 'ADAPTER_FAILED', message: reason }],
            };
        }
    })();

    return chainResult(adapted, (candidateRecord) =>
        chainResult(parseSavedInterfaceRecordForPreview(candidateRecord), (parsedRecord) =>
            validateSampleGraphSemantic(parsedRecord)
        )
    );
}

export function warnIfInvalidCurrentSamplePreviewExportOnce(): void {
    if (!import.meta.env.DEV) return;
    if (hasWarnedInvalidSample) return;
    const result = validateCurrentSamplePreviewExport();
    if (result.ok) return;
    hasWarnedInvalidSample = true;
    const summary = result.errors.map((item) => item.code).join(', ');
    console.warn('[SampleGraphPreview] sample_export_invalid codes=%s', summary);
}
