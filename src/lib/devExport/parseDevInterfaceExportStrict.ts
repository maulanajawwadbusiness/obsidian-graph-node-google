import type { DevInterfaceExportV1 } from './devExportTypes';
import { createValidationError } from '../validation/errors';
import { err, ok, type Result } from '../validation/result';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function parseDevInterfaceExportStrict(value: unknown): Result<DevInterfaceExportV1> {
    if (!isObject(value)) {
        return err(createValidationError('DEV_EXPORT_NOT_OBJECT', 'dev export must be an object'));
    }
    if (value.version !== 1) {
        return err(createValidationError('DEV_EXPORT_VERSION_UNSUPPORTED', 'dev export version must be 1', 'version'));
    }
    if (!isFiniteNumber(value.exportedAt)) {
        return err(createValidationError('DEV_EXPORT_EXPORTED_AT_INVALID', 'exportedAt must be finite number', 'exportedAt'));
    }
    if (typeof value.title !== 'string' || value.title.trim().length === 0) {
        return err(createValidationError('DEV_EXPORT_TITLE_INVALID', 'title must be non-empty string', 'title'));
    }

    if (!isObject(value.topology)) {
        return err(createValidationError('DEV_EXPORT_TOPOLOGY_MISSING', 'topology is required', 'topology'));
    }
    if (!Array.isArray(value.topology.nodes) || !Array.isArray(value.topology.links)) {
        return err(createValidationError('DEV_EXPORT_TOPOLOGY_INVALID', 'topology.nodes and topology.links must be arrays', 'topology'));
    }

    if (!isObject(value.layout) || !isObject(value.layout.nodeWorld)) {
        return err(createValidationError('DEV_EXPORT_LAYOUT_INVALID', 'layout.nodeWorld is required', 'layout.nodeWorld'));
    }

    if (!isObject(value.camera)) {
        return err(createValidationError('DEV_EXPORT_CAMERA_INVALID', 'camera is required', 'camera'));
    }
    if (
        !isFiniteNumber(value.camera.panX) ||
        !isFiniteNumber(value.camera.panY) ||
        !isFiniteNumber(value.camera.zoom)
    ) {
        return err(createValidationError('DEV_EXPORT_CAMERA_INVALID', 'camera panX/panY/zoom must be finite numbers', 'camera'));
    }

    return ok(value as DevInterfaceExportV1);
}
