import type { ParsedDocument } from '../document/types';
import type { Topology } from '../graph/topologyTypes';

export const SAVED_INTERFACES_KEY = 'arnvoid_saved_interfaces_v1';
export const DEFAULT_SAVED_INTERFACES_CAP = 20;

export type SavedInterfaceSource = 'paste' | 'file' | 'unknown';

export type SavedInterfaceAnalysisNodeV1 = {
    sourceTitle?: string;
    sourceSummary?: string;
};

export type SavedInterfaceAnalysisMetaV1 = {
    version: 1;
    nodesById: Record<string, SavedInterfaceAnalysisNodeV1>;
};

export type SavedInterfaceRecordV1 = {
    id: string;
    createdAt: number;
    updatedAt: number;
    title: string;
    docId: string;
    source: SavedInterfaceSource;
    fileName?: string;
    mimeType?: string;
    parsedDocument: ParsedDocument;
    topology: Topology;
    analysisMeta?: SavedInterfaceAnalysisMetaV1;
    layout?: {
        nodeWorld: Record<string, { x: number; y: number }>;
    };
    camera?: {
        panX: number;
        panY: number;
        zoom: number;
    };
    preview: {
        nodeCount: number;
        linkCount: number;
        charCount: number;
        wordCount: number;
    };
    dedupeKey: string;
};

export type UpsertSavedInterfaceOptions = {
    cap?: number;
    nowMs?: number;
};

function canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isSavedInterfaceSource(value: unknown): value is SavedInterfaceSource {
    return value === 'paste' || value === 'file' || value === 'unknown';
}

function isNodeWorldPoint(value: unknown): value is { x: number; y: number } {
    if (!isObject(value)) return false;
    return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isNodeWorldMap(value: unknown): value is Record<string, { x: number; y: number }> {
    if (!isObject(value)) return false;
    const entries = Object.entries(value);
    for (const [key, point] of entries) {
        if (typeof key !== 'string') return false;
        if (!isNodeWorldPoint(point)) return false;
    }
    return true;
}

function isLayoutSnapshot(value: unknown): value is SavedInterfaceRecordV1['layout'] {
    if (!isObject(value)) return false;
    return isNodeWorldMap(value.nodeWorld);
}

function isCameraSnapshot(value: unknown): value is SavedInterfaceRecordV1['camera'] {
    if (!isObject(value)) return false;
    return (
        isFiniteNumber(value.panX) &&
        isFiniteNumber(value.panY) &&
        isFiniteNumber(value.zoom)
    );
}

function isAnalysisNodeV1(value: unknown): value is SavedInterfaceAnalysisNodeV1 {
    if (!isObject(value)) return false;
    if (value.sourceTitle !== undefined && typeof value.sourceTitle !== 'string') return false;
    if (value.sourceSummary !== undefined && typeof value.sourceSummary !== 'string') return false;
    return true;
}

function isAnalysisMetaV1(value: unknown): value is SavedInterfaceAnalysisMetaV1 {
    if (!isObject(value)) return false;
    if (value.version !== 1) return false;
    if (!isObject(value.nodesById)) return false;
    for (const [key, nodeData] of Object.entries(value.nodesById)) {
        if (typeof key !== 'string') return false;
        if (!isAnalysisNodeV1(nodeData)) return false;
    }
    return true;
}

function isSavedInterfaceRecordV1(value: unknown): value is SavedInterfaceRecordV1 {
    if (!isObject(value)) return false;

    if (typeof value.id !== 'string') return false;
    if (!isFiniteNumber(value.createdAt)) return false;
    if (!isFiniteNumber(value.updatedAt)) return false;
    if (typeof value.title !== 'string') return false;
    if (typeof value.docId !== 'string') return false;
    if (!isSavedInterfaceSource(value.source)) return false;
    if (typeof value.dedupeKey !== 'string') return false;

    if (!isObject(value.parsedDocument)) return false;
    if (typeof value.parsedDocument.text !== 'string') return false;
    if (!Array.isArray(value.parsedDocument.warnings)) return false;
    if (!isObject(value.parsedDocument.meta)) return false;

    if (!isObject(value.topology)) return false;
    if (!Array.isArray(value.topology.nodes)) return false;
    if (!Array.isArray(value.topology.links)) return false;

    if (!isObject(value.preview)) return false;
    if (!isFiniteNumber(value.preview.nodeCount)) return false;
    if (!isFiniteNumber(value.preview.linkCount)) return false;
    if (!isFiniteNumber(value.preview.charCount)) return false;
    if (!isFiniteNumber(value.preview.wordCount)) return false;
    if (value.analysisMeta !== undefined && !isAnalysisMetaV1(value.analysisMeta)) return false;
    if (value.layout !== undefined && !isLayoutSnapshot(value.layout)) return false;
    if (value.camera !== undefined && !isCameraSnapshot(value.camera)) return false;

    return true;
}

function sanitizeSavedInterfaceRecord(value: unknown): SavedInterfaceRecordV1 | null {
    if (!isObject(value)) return null;
    const analysisMetaRaw = value.analysisMeta;
    const normalized: Record<string, unknown> = {
        ...value,
        analysisMeta: undefined,
    };
    if (analysisMetaRaw !== undefined) {
        if (isAnalysisMetaV1(analysisMetaRaw)) {
            normalized.analysisMeta = analysisMetaRaw;
        } else {
            const idForLog = typeof value.id === 'string' ? value.id : 'unknown';
            console.warn('[savedInterfaces] analysisMeta_invalid_dropped id=%s', idForLog);
        }
    }
    return isSavedInterfaceRecordV1(normalized) ? normalized : null;
}

function normalizeCap(cap: number | undefined): number {
    if (!isFiniteNumber(cap)) return DEFAULT_SAVED_INTERFACES_CAP;
    const normalized = Math.floor(cap);
    return normalized > 0 ? normalized : DEFAULT_SAVED_INTERFACES_CAP;
}

function compareNewestFirst(a: SavedInterfaceRecordV1, b: SavedInterfaceRecordV1): number {
    if (a.updatedAt !== b.updatedAt) {
        return b.updatedAt - a.updatedAt;
    }
    return b.createdAt - a.createdAt;
}

function sortNewestFirst(list: SavedInterfaceRecordV1[]): SavedInterfaceRecordV1[] {
    return [...list].sort(compareNewestFirst);
}

function applyCap(list: SavedInterfaceRecordV1[], cap: number): SavedInterfaceRecordV1[] {
    if (list.length <= cap) return list;
    return list.slice(0, cap);
}

function stableSerialize(value: unknown): string {
    if (value === null) return 'null';

    const valueType = typeof value;
    if (valueType === 'string') {
        return JSON.stringify(value);
    }
    if (valueType === 'number') {
        if (!Number.isFinite(value as number)) return 'null';
        return String(value);
    }
    if (valueType === 'boolean') {
        return (value as boolean) ? 'true' : 'false';
    }
    if (valueType !== 'object') {
        return 'null';
    }

    if (Array.isArray(value)) {
        const items = value.map((item) => stableSerialize(item));
        return `[${items.join(',')}]`;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries: string[] = [];

    for (const key of keys) {
        const raw = obj[key];
        const normalized = raw === undefined ? null : raw;
        entries.push(`${JSON.stringify(key)}:${stableSerialize(normalized)}`);
    }

    return `{${entries.join(',')}}`;
}

function stableHashDjb2(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

export function buildSavedInterfaceDedupeKey(input: {
    docId: string;
    title: string;
    topology: Topology;
}): string {
    const canonical = stableSerialize({
        title: input.title,
        topology: input.topology,
    });
    const hash = stableHashDjb2(canonical);
    return `${input.docId}::${hash}`;
}

export function loadSavedInterfaces(): SavedInterfaceRecordV1[] {
    if (!canUseLocalStorage()) return [];

    const raw = window.localStorage.getItem(SAVED_INTERFACES_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }
        const sanitized: SavedInterfaceRecordV1[] = [];
        for (const item of parsed) {
            const normalized = sanitizeSavedInterfaceRecord(item);
            if (normalized) {
                sanitized.push(normalized);
            }
        }
        return sortNewestFirst(sanitized);
    } catch {
        return [];
    }
}

export function saveAllSavedInterfaces(list: SavedInterfaceRecordV1[]): void {
    if (!canUseLocalStorage()) return;

    const sorted = sortNewestFirst(list);

    try {
        window.localStorage.setItem(SAVED_INTERFACES_KEY, JSON.stringify(sorted));
    } catch {
        console.warn('[savedInterfaces] localStorage_quota_exceeded');
    }
}

export function upsertSavedInterface(
    record: SavedInterfaceRecordV1,
    opts?: UpsertSavedInterfaceOptions
): SavedInterfaceRecordV1[] {
    const nowMs = opts?.nowMs ?? Date.now();
    const cap = normalizeCap(opts?.cap);
    const current = loadSavedInterfaces();

    const existingIndex = current.findIndex((item) => item.dedupeKey === record.dedupeKey);

    let next: SavedInterfaceRecordV1[];
    if (existingIndex >= 0) {
        const existing = current[existingIndex];
        const updated: SavedInterfaceRecordV1 = {
            ...record,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: nowMs,
        };

        next = [
            updated,
            ...current.filter((_, index) => index !== existingIndex),
        ];
    } else {
        const inserted: SavedInterfaceRecordV1 = {
            ...record,
            createdAt: isFiniteNumber(record.createdAt) ? record.createdAt : nowMs,
            updatedAt: nowMs,
        };
        next = [inserted, ...current];
    }

    const sorted = sortNewestFirst(next);
    const capped = applyCap(sorted, cap);
    saveAllSavedInterfaces(capped);
    return capped;
}

export function deleteSavedInterface(id: string): SavedInterfaceRecordV1[] {
    const current = loadSavedInterfaces();
    const next = current.filter((item) => item.id !== id);
    saveAllSavedInterfaces(next);
    return next;
}

export function patchSavedInterfaceLayout(
    id: string,
    layout: SavedInterfaceRecordV1['layout'],
    camera?: SavedInterfaceRecordV1['camera']
): SavedInterfaceRecordV1[] {
    const current = loadSavedInterfaces();
    const index = current.findIndex((item) => item.id === id);
    if (index < 0) {
        return current;
    }

    const nowMs = Date.now();
    const next = [...current];
    const existing = next[index];
    next[index] = {
        ...existing,
        layout,
        camera: camera !== undefined ? camera : existing.camera,
        updatedAt: nowMs,
    };

    saveAllSavedInterfaces(next);
    return loadSavedInterfaces();
}

export function patchSavedInterfaceTitle(
    id: string,
    newTitle: string
): SavedInterfaceRecordV1[] {
    const current = loadSavedInterfaces();
    const index = current.findIndex((item) => item.id === id);
    if (index < 0) {
        if (import.meta.env.DEV) {
            console.log('[savedInterfaces] title_patch_skipped reason=not_found');
        }
        return current;
    }

    const nowMs = Date.now();
    const next = [...current];
    const existing = next[index];
    next[index] = {
        ...existing,
        title: newTitle,
        updatedAt: nowMs,
    };

    saveAllSavedInterfaces(next);
    if (import.meta.env.DEV) {
        console.log('[savedInterfaces] title_patch ok id=%s', id);
    }
    return loadSavedInterfaces();
}
