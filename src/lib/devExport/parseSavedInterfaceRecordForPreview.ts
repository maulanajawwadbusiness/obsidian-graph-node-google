import {
    parseSavedInterfaceRecord,
    type SavedInterfaceRecordV1,
} from '../../store/savedInterfacesStore';
import { createValidationError } from '../validation/errors';
import { err, ok, type Result } from '../validation/result';

export function parseSavedInterfaceRecordForPreview(value: unknown): Result<SavedInterfaceRecordV1> {
    const parsed = parseSavedInterfaceRecord(value);
    if (!parsed) {
        return err(createValidationError(
            'SAVED_RECORD_PARSE_FAILED',
            'saved interface parser rejected preview record'
        ));
    }
    if (!parsed.topology || !Array.isArray(parsed.topology.nodes) || !Array.isArray(parsed.topology.links)) {
        return err(createValidationError(
            'SAVED_RECORD_TOPOLOGY_INVALID',
            'preview record must contain topology nodes and links',
            'topology'
        ));
    }
    if (!parsed.layout || typeof parsed.layout !== 'object' || !parsed.layout.nodeWorld) {
        return err(createValidationError(
            'SAVED_RECORD_LAYOUT_MISSING',
            'preview record must contain layout.nodeWorld',
            'layout.nodeWorld'
        ));
    }
    if (!parsed.camera || typeof parsed.camera !== 'object') {
        return err(createValidationError(
            'SAVED_RECORD_CAMERA_MISSING',
            'preview record must contain camera',
            'camera'
        ));
    }
    return ok(parsed);
}
