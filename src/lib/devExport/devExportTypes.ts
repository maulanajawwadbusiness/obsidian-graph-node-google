import type { ParsedDocument } from '../../document/types';
import type { Topology } from '../../graph/topologyTypes';

export type DevExportAnalysisMetaV1 = {
    version: 1;
    nodesById: Record<string, { sourceTitle?: string; sourceSummary?: string }>;
};

export type DevInterfaceExportV1 = {
    version: 1;
    exportedAt: number;
    title: string;
    parsedDocument: ParsedDocument | null;
    topology: Topology | null;
    layout: { nodeWorld: Record<string, { x: number; y: number }> } | null;
    camera: { panX: number; panY: number; zoom: number } | null;
    analysisMeta: DevExportAnalysisMetaV1 | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDevInterfaceExportV1(value: unknown): DevInterfaceExportV1 | null {
    if (!isObject(value)) return null;
    if (value.version !== 1) return null;
    if (typeof value.exportedAt !== 'number' || !Number.isFinite(value.exportedAt)) return null;
    if (typeof value.title !== 'string') return null;
    if (value.parsedDocument !== null && !isObject(value.parsedDocument)) return null;
    if (value.topology !== null && !isObject(value.topology)) return null;
    if (value.layout !== null && !isObject(value.layout)) return null;
    if (value.camera !== null && !isObject(value.camera)) return null;
    if (value.analysisMeta !== null && !isObject(value.analysisMeta)) return null;
    return value as DevInterfaceExportV1;
}
