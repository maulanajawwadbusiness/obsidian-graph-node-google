import type { SavedInterfaceRecordV1 } from '../../store/savedInterfacesStore';
import { createValidationError } from '../validation/errors';
import { err, ok, type Result } from '../validation/result';

export const SAMPLE_PREVIEW_REQUIRE_NONEMPTY_TOPOLOGY = true;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function validateSampleGraphSemantic(record: SavedInterfaceRecordV1): Result<void> {
    const errors: ReturnType<typeof createValidationError>[] = [];
    const nodes = record.topology.nodes ?? [];
    const links = record.topology.links ?? [];

    if (SAMPLE_PREVIEW_REQUIRE_NONEMPTY_TOPOLOGY && nodes.length <= 0) {
        errors.push(createValidationError('SEMANTIC_TOPOLOGY_EMPTY', 'topology.nodes must be non-empty', 'topology.nodes'));
    }

    const nodeIdSet = new Set<string>();
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const id = typeof node?.id === 'string' ? node.id.trim() : '';
        if (!id) {
            errors.push(createValidationError('SEMANTIC_NODE_ID_INVALID', 'node id must be non-empty string', `topology.nodes[${i}].id`));
            continue;
        }
        if (nodeIdSet.has(id)) {
            errors.push(createValidationError('SEMANTIC_NODE_ID_INVALID', `duplicate node id: ${id}`, `topology.nodes[${i}].id`));
            continue;
        }
        nodeIdSet.add(id);
    }

    for (let i = 0; i < links.length; i += 1) {
        const link = links[i] as { from?: unknown; to?: unknown };
        const from = typeof link.from === 'string' ? link.from.trim() : '';
        const to = typeof link.to === 'string' ? link.to.trim() : '';
        if (!from || !to || !nodeIdSet.has(from) || !nodeIdSet.has(to)) {
            errors.push(createValidationError(
                'SEMANTIC_EDGE_REF_INVALID',
                'link endpoints must reference existing node ids',
                `topology.links[${i}]`
            ));
        }
    }

    const nodeWorld = record.layout?.nodeWorld;
    if (!nodeWorld || typeof nodeWorld !== 'object') {
        errors.push(createValidationError(
            'SEMANTIC_LAYOUT_NODEWORLD_MISSING',
            'layout.nodeWorld is required',
            'layout.nodeWorld'
        ));
    } else {
        for (const nodeId of nodeIdSet) {
            const point = (nodeWorld as Record<string, unknown>)[nodeId];
            const x = (point as { x?: unknown } | undefined)?.x;
            const y = (point as { y?: unknown } | undefined)?.y;
            if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
                errors.push(createValidationError(
                    'SEMANTIC_LAYOUT_COORD_INVALID',
                    'nodeWorld coordinates must be finite numbers for all topology node ids',
                    `layout.nodeWorld.${nodeId}`
                ));
            }
        }
    }

    const camera = record.camera;
    if (!camera || !isFiniteNumber(camera.panX) || !isFiniteNumber(camera.panY) || !isFiniteNumber(camera.zoom)) {
        errors.push(createValidationError(
            'SEMANTIC_CAMERA_INVALID',
            'camera panX/panY/zoom must be finite numbers',
            'camera'
        ));
    } else if (camera.zoom <= 0 || camera.zoom > 20) {
        errors.push(createValidationError(
            'SEMANTIC_CAMERA_INVALID',
            'camera.zoom must be within sane bounds (0, 20]',
            'camera.zoom'
        ));
    }

    const analysisNodesById = record.analysisMeta?.nodesById;
    if (analysisNodesById && typeof analysisNodesById === 'object') {
        for (const key of Object.keys(analysisNodesById)) {
            if (!nodeIdSet.has(key)) {
                errors.push(createValidationError(
                    'SEMANTIC_ANALYSIS_META_MISMATCH',
                    'analysisMeta.nodesById contains ids not present in topology.nodes',
                    `analysisMeta.nodesById.${key}`
                ));
            }
        }
    }

    if (errors.length > 0) return err(errors);
    return ok(undefined);
}
