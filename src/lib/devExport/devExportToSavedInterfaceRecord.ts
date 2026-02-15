import type { ParsedDocument } from '../../document/types';
import {
    buildSavedInterfaceDedupeKey,
    type SavedInterfaceRecordV1,
} from '../../store/savedInterfacesStore';
import type { DevInterfaceExportV1 } from './devExportTypes';

type DevExportAdapterOptions = {
    preview?: boolean;
    allowEmptyTopology?: boolean;
};

function assertDevExportForAdapter(dev: DevInterfaceExportV1): void {
    if (dev.version !== 1) {
        throw new Error('invalid_dev_export_version');
    }
    if (!Number.isFinite(dev.exportedAt)) {
        throw new Error('invalid_dev_export_exported_at');
    }
    if (typeof dev.title !== 'string') {
        throw new Error('invalid_dev_export_title');
    }
}

function countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

function sanitizeToken(input: string): string {
    const normalized = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'sample';
}

function createDeterministicId(input: { title: string; exportedAt: number }): string {
    return `sample-preview:${sanitizeToken(input.title)}:${Math.floor(input.exportedAt)}`;
}

function ensureParsedDocument(
    parsed: DevInterfaceExportV1['parsedDocument'],
    fallbackTitle: string,
    exportedAt: number
): ParsedDocument {
    if (parsed) {
        return parsed;
    }
    const fallbackText = '';
    return {
        id: `sample-doc-${Math.floor(exportedAt)}`,
        fileName: `${fallbackTitle}.txt`,
        mimeType: 'text/plain',
        sourceType: 'txt',
        text: fallbackText,
        warnings: [],
        meta: {
            wordCount: 0,
            charCount: 0,
        },
    };
}

function ensureTopology(
    topology: DevInterfaceExportV1['topology'],
    opts?: DevExportAdapterOptions
): SavedInterfaceRecordV1['topology'] {
    if (!topology) {
        if (opts?.allowEmptyTopology) {
            return { nodes: [], links: [], springs: [] };
        }
        throw new Error('DEVEXPORT_TOPOLOGY_MISSING');
    }
    if (!Array.isArray(topology.nodes) || !Array.isArray(topology.links)) {
        if (opts?.allowEmptyTopology) {
            return { nodes: [], links: [], springs: [] };
        }
        throw new Error('DEVEXPORT_TOPOLOGY_INVALID');
    }
    return topology;
}

export function devExportToSavedInterfaceRecordV1(
    dev: DevInterfaceExportV1,
    opts?: DevExportAdapterOptions
): SavedInterfaceRecordV1 {
    assertDevExportForAdapter(dev);
    const exportedAt = Math.floor(dev.exportedAt);
    const title = (dev.title || 'Sample Preview').trim() || 'Sample Preview';
    const parsedDocument = ensureParsedDocument(dev.parsedDocument, title, exportedAt);
    const topology = ensureTopology(dev.topology, opts);
    const previewNodeCount = topology.nodes.length;
    const previewLinkCount = topology.links.length;
    const previewCharCount = parsedDocument.text.length;
    const previewWordCount = countWords(parsedDocument.text);
    const docId = parsedDocument.id || `sample-doc-${exportedAt}`;
    const id = createDeterministicId({ title, exportedAt });
    const source: SavedInterfaceRecordV1['source'] = opts?.preview ? 'unknown' : 'file';
    const dedupeKey = buildSavedInterfaceDedupeKey({
        docId,
        title,
        topology,
    });

    return {
        id,
        createdAt: exportedAt,
        updatedAt: exportedAt,
        title,
        docId,
        source,
        fileName: parsedDocument.fileName,
        mimeType: parsedDocument.mimeType,
        parsedDocument,
        topology,
        analysisMeta: dev.analysisMeta ?? undefined,
        layout: dev.layout ?? undefined,
        camera: dev.camera ?? undefined,
        preview: {
            nodeCount: previewNodeCount,
            linkCount: previewLinkCount,
            charCount: previewCharCount,
            wordCount: previewWordCount,
        },
        dedupeKey,
    };
}
