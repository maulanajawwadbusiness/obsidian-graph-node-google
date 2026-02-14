import React from 'react';
import {
    deleteSavedInterface as deleteSavedInterfaceRemote,
    listSavedInterfaces,
    upsertSavedInterface as upsertSavedInterfaceRemote,
} from '../../../api';
import {
    buildSavedInterfacesStorageKeyForUser,
    DEFAULT_SAVED_INTERFACES_CAP,
    SAVED_INTERFACES_KEY,
    parseSavedInterfaceRecord,
    setSavedInterfacesStorageKey,
    SavedInterfaceRecordV1,
} from '../../../store/savedInterfacesStore';

const REMOTE_BACKFILL_LIMIT = 10;
const REMOTE_OUTBOX_KEY_PREFIX = `${SAVED_INTERFACES_KEY}_remote_outbox`;
const REMOTE_RETRY_BASE_MS = 30_000;
const REMOTE_RETRY_MAX_MS = 5 * 60_000;
const REMOTE_OUTBOX_PAUSE_401_MS = 60_000;

const hydratedStorageKeysSession = new Set<string>();
const backfilledStorageKeysSession = new Set<string>();
let lastIdentityKeySession: string | null = null;

type PendingAnalysisPayload =
    | { kind: 'text'; text: string; createdAt: number }
    | { kind: 'file'; file: File; createdAt: number }
    | null;

type RemoteOutboxOp = 'upsert' | 'delete';

type RemoteOutboxItem = {
    id: string;
    identityKey: string;
    op: RemoteOutboxOp;
    clientInterfaceId: string;
    payload?: SavedInterfaceRecordV1;
    attempt: number;
    nextRetryAt: number;
    createdAt: number;
    lastErrorCode?: string;
    nonRetryable?: boolean;
};

type UseSavedInterfacesSyncArgs = {
    isAuthReady: boolean;
    isLoggedIn: boolean;
    authStorageId: string | null;
    authIdentityKey: string | null;
    isRestoreReadPathActive: () => boolean;
    refreshSavedInterfaces: () => SavedInterfaceRecordV1[];
    loadSavedInterfacesFn: () => SavedInterfaceRecordV1[];
    commitHydrateMerge: (merged: SavedInterfaceRecordV1[]) => SavedInterfaceRecordV1[];
    setPendingLoadInterface: React.Dispatch<React.SetStateAction<SavedInterfaceRecordV1 | null>>;
    setPendingAnalysis: React.Dispatch<React.SetStateAction<PendingAnalysisPayload>>;
    closeDeleteConfirm: () => void;
    resetSearchUi: () => void;
    activeStorageKeyRef: React.MutableRefObject<string>;
};

type SavedInterfacesSyncStatus = {
    draining: boolean;
    pausedUntil: number;
    hydratedStorageKey: string | null;
    activeIdentityKey: string;
};

type UseSavedInterfacesSyncResult = {
    enqueueRemoteUpsert: (record: SavedInterfaceRecordV1, reason: string) => void;
    enqueueRemoteDelete: (id: string, reason: string) => void;
    syncStatus: SavedInterfacesSyncStatus;
};

function buildSyncStamp(record: SavedInterfaceRecordV1): string {
    return `${record.updatedAt}|${record.title}`;
}

function parseIsoMs(value: string | null | undefined): number | null {
    if (!value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function sortAndCapSavedInterfaces(
    list: SavedInterfaceRecordV1[],
    cap = DEFAULT_SAVED_INTERFACES_CAP
): SavedInterfaceRecordV1[] {
    const sorted = [...list].sort((a, b) => {
        if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
        return b.createdAt - a.createdAt;
    });
    if (sorted.length <= cap) return sorted;
    return sorted.slice(0, cap);
}

function canUseBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildRemoteOutboxStorageKey(identityKey: string): string {
    return `${REMOTE_OUTBOX_KEY_PREFIX}_${identityKey}`;
}

function parseRemoteOutbox(raw: string | null, identityKey: string): RemoteOutboxItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        const items: RemoteOutboxItem[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const typed = item as Record<string, unknown>;
            const op = typed.op === 'upsert' || typed.op === 'delete' ? typed.op : null;
            const clientInterfaceId = typeof typed.clientInterfaceId === 'string' ? typed.clientInterfaceId : '';
            if (!op || !clientInterfaceId) continue;
            const nextRetryAt = typeof typed.nextRetryAt === 'number' && Number.isFinite(typed.nextRetryAt)
                ? typed.nextRetryAt
                : Date.now();
            const createdAt = typeof typed.createdAt === 'number' && Number.isFinite(typed.createdAt)
                ? typed.createdAt
                : Date.now();
            const attempt = typeof typed.attempt === 'number' && Number.isFinite(typed.attempt)
                ? Math.max(0, Math.floor(typed.attempt))
                : 0;
            const payload = op === 'upsert' ? parseSavedInterfaceRecord(typed.payload) ?? undefined : undefined;
            items.push({
                id: typeof typed.id === 'string' && typed.id ? typed.id : `${identityKey}:${op}:${clientInterfaceId}:${createdAt}`,
                identityKey,
                op,
                clientInterfaceId,
                payload,
                attempt,
                nextRetryAt,
                createdAt,
                lastErrorCode: typeof typed.lastErrorCode === 'string' ? typed.lastErrorCode : undefined,
                nonRetryable: typed.nonRetryable === true,
            });
        }
        return items;
    } catch {
        return [];
    }
}

function classifyRemoteError(error: unknown): { code: string; retryable: boolean; pauseAuth: boolean } {
    const message = String(error ?? 'unknown');
    const lower = message.toLowerCase();
    if (lower.includes('payload_missing')) {
        return { code: 'payload_missing', retryable: false, pauseAuth: false };
    }
    const codeMatch = message.match(/\b(401|403|413|429|5\d\d)\b/);
    const code = codeMatch?.[1] ?? 'unknown';
    if (code === '401') {
        return { code, retryable: true, pauseAuth: true };
    }
    if (code === '413') {
        return { code, retryable: false, pauseAuth: false };
    }
    if (code === '429') {
        return { code, retryable: true, pauseAuth: false };
    }
    if (code.startsWith('5')) {
        return { code, retryable: true, pauseAuth: false };
    }
    if (lower.includes('timeout') || lower.includes('network') || lower.includes('failed to fetch') || code === 'unknown') {
        return { code: code === 'unknown' ? 'network' : code, retryable: true, pauseAuth: false };
    }
    return { code, retryable: false, pauseAuth: false };
}

function computeRetryDelayMs(attempt: number): number {
    const power = Math.max(0, attempt - 1);
    const base = Math.min(REMOTE_RETRY_MAX_MS, REMOTE_RETRY_BASE_MS * Math.pow(2, power));
    const jitter = Math.floor(base * (0.15 * Math.random()));
    return Math.min(REMOTE_RETRY_MAX_MS, base + jitter);
}

export function useSavedInterfacesSync(args: UseSavedInterfacesSyncArgs): UseSavedInterfacesSyncResult {
    const {
        isAuthReady,
        isLoggedIn,
        authStorageId,
        authIdentityKey,
        isRestoreReadPathActive,
        refreshSavedInterfaces,
        loadSavedInterfacesFn,
        commitHydrateMerge,
        setPendingLoadInterface,
        setPendingAnalysis,
        closeDeleteConfirm,
        resetSearchUi,
        activeStorageKeyRef,
    } = args;
    const authIdentityKeyRef = React.useRef<string>('guest');
    const syncEpochRef = React.useRef(0);
    const prevIdentityKeyRef = React.useRef<string | null>(null);
    const hydratedStorageKeyRef = React.useRef<string | null>(null);
    const backfilledStorageKeyRef = React.useRef<string | null>(null);
    const lastSyncedStampByIdRef = React.useRef<Map<string, string>>(new Map());
    const remoteSyncEnabledRef = React.useRef(false);
    const remoteKnownUpdatedAtByIdRef = React.useRef<Map<string, number>>(new Map());
    const remoteOutboxRef = React.useRef<RemoteOutboxItem[]>([]);
    const remoteOutboxStorageKeyRef = React.useRef<string>('');
    const remoteOutboxDrainTimerRef = React.useRef<number | null>(null);
    const remoteOutboxDrainingRef = React.useRef(false);
    const remoteOutboxPausedUntilRef = React.useRef<number>(0);
    const persistRemoteOutbox = React.useCallback((items: RemoteOutboxItem[]) => {
        if (!canUseBrowserStorage()) return;
        if (!remoteOutboxStorageKeyRef.current) return;
        try {
            window.localStorage.setItem(remoteOutboxStorageKeyRef.current, JSON.stringify(items));
        } catch {
            console.warn('[savedInterfaces] remote_outbox_persist_failed');
        }
    }, []);
    const scheduleRemoteOutboxDrain = React.useCallback((delayMs = 0) => {
        if (remoteOutboxDrainTimerRef.current !== null) {
            window.clearTimeout(remoteOutboxDrainTimerRef.current);
            remoteOutboxDrainTimerRef.current = null;
        }
        if (delayMs < 0) return;
        remoteOutboxDrainTimerRef.current = window.setTimeout(() => {
            remoteOutboxDrainTimerRef.current = null;
            void drainRemoteOutbox();
        }, Math.max(0, Math.floor(delayMs)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const updateRemoteOutbox = React.useCallback((updater: (current: RemoteOutboxItem[]) => RemoteOutboxItem[]) => {
        const next = updater(remoteOutboxRef.current);
        remoteOutboxRef.current = next;
        persistRemoteOutbox(next);
        return next;
    }, [persistRemoteOutbox]);
    const drainRemoteOutbox = React.useCallback(async () => {
        if (remoteOutboxDrainingRef.current) return;
        if (!remoteSyncEnabledRef.current) return;
        if (isRestoreReadPathActive()) {
            scheduleRemoteOutboxDrain(1000);
            return;
        }
        const epochAtStart = syncEpochRef.current;
        const identityAtStart = authIdentityKeyRef.current;
        const storageKeyAtStart = remoteOutboxStorageKeyRef.current;
        if (!storageKeyAtStart) return;
        remoteOutboxDrainingRef.current = true;
        try {
            while (true) {
                if (!remoteSyncEnabledRef.current) return;
                if (isRestoreReadPathActive()) return;
                if (syncEpochRef.current !== epochAtStart) return;
                if (authIdentityKeyRef.current !== identityAtStart) return;
                if (remoteOutboxStorageKeyRef.current !== storageKeyAtStart) return;
                const now = Date.now();
                if (remoteOutboxPausedUntilRef.current > now) {
                    scheduleRemoteOutboxDrain(remoteOutboxPausedUntilRef.current - now);
                    return;
                }
                const queue = remoteOutboxRef.current
                    .filter((item) => !item.nonRetryable && item.identityKey === identityAtStart)
                    .sort((a, b) => a.nextRetryAt - b.nextRetryAt || a.createdAt - b.createdAt);
                if (queue.length === 0) return;
                const item = queue[0];
                if (item.nextRetryAt > now) {
                    scheduleRemoteOutboxDrain(item.nextRetryAt - now);
                    return;
                }
                try {
                    if (item.op === 'upsert') {
                        if (!item.payload) {
                            throw new Error('payload_missing');
                        }
                        await upsertSavedInterfaceRemote({
                            clientInterfaceId: item.clientInterfaceId,
                            title: item.payload.title,
                            payloadVersion: 1,
                            payloadJson: item.payload,
                        });
                        const stamp = buildSyncStamp(item.payload);
                        lastSyncedStampByIdRef.current.set(item.clientInterfaceId, stamp);
                        remoteKnownUpdatedAtByIdRef.current.set(item.clientInterfaceId, item.payload.updatedAt);
                    } else {
                        await deleteSavedInterfaceRemote(item.clientInterfaceId);
                        lastSyncedStampByIdRef.current.delete(item.clientInterfaceId);
                        remoteKnownUpdatedAtByIdRef.current.delete(item.clientInterfaceId);
                    }
                    updateRemoteOutbox((current) => current.filter((entry) => entry.id !== item.id));
                    console.log('[savedInterfaces] remote_outbox_success op=%s id=%s attempt=%d', item.op, item.clientInterfaceId, item.attempt);
                    continue;
                } catch (error) {
                    const classified = classifyRemoteError(error);
                    if (classified.pauseAuth) {
                        remoteOutboxPausedUntilRef.current = now + REMOTE_OUTBOX_PAUSE_401_MS;
                        updateRemoteOutbox((current) => current.map((entry) => (
                            entry.id === item.id
                                ? { ...entry, attempt: entry.attempt + 1, nextRetryAt: remoteOutboxPausedUntilRef.current, lastErrorCode: classified.code }
                                : entry
                        )));
                        console.log('[savedInterfaces] remote_outbox_paused_401 id=%s', item.clientInterfaceId);
                        scheduleRemoteOutboxDrain(REMOTE_OUTBOX_PAUSE_401_MS);
                        return;
                    }
                    if (!classified.retryable) {
                        updateRemoteOutbox((current) => current.filter((entry) => entry.id !== item.id));
                        if (import.meta.env.DEV) {
                            console.log('[savedInterfaces] remote_outbox_drop_non_retryable op=%s id=%s code=%s', item.op, item.clientInterfaceId, classified.code);
                        }
                        continue;
                    }
                    const nextAttempt = item.attempt + 1;
                    const delayMs = computeRetryDelayMs(nextAttempt);
                    const nextRetryAt = now + delayMs;
                    updateRemoteOutbox((current) => current.map((entry) => (
                        entry.id === item.id
                            ? { ...entry, attempt: nextAttempt, nextRetryAt, lastErrorCode: classified.code }
                            : entry
                    )));
                    console.log('[savedInterfaces] remote_outbox_retry_scheduled op=%s id=%s attempt=%d delay_ms=%d code=%s', item.op, item.clientInterfaceId, nextAttempt, delayMs, classified.code);
                    scheduleRemoteOutboxDrain(delayMs);
                    return;
                }
            }
        } finally {
            remoteOutboxDrainingRef.current = false;
        }
    }, [isRestoreReadPathActive, scheduleRemoteOutboxDrain, updateRemoteOutbox]);
    const enqueueRemoteUpsert = React.useCallback((record: SavedInterfaceRecordV1, reason: string) => {
        if (!remoteSyncEnabledRef.current) return;
        const identityKey = authIdentityKeyRef.current;
        const stamp = buildSyncStamp(record);
        if (lastSyncedStampByIdRef.current.get(record.id) === stamp) return;
        updateRemoteOutbox((current) => {
            const withoutDelete = current.filter((entry) => !(entry.identityKey === identityKey && entry.clientInterfaceId === record.id && entry.op === 'delete'));
            const existingIndex = withoutDelete.findIndex((entry) => entry.identityKey === identityKey && entry.clientInterfaceId === record.id && entry.op === 'upsert');
            const nextItem: RemoteOutboxItem = {
                id: existingIndex >= 0 ? withoutDelete[existingIndex].id : `${identityKey}:upsert:${record.id}:${Date.now()}`,
                identityKey,
                op: 'upsert',
                clientInterfaceId: record.id,
                payload: record,
                attempt: 0,
                nextRetryAt: Date.now(),
                createdAt: existingIndex >= 0 ? withoutDelete[existingIndex].createdAt : Date.now(),
            };
            if (existingIndex >= 0) {
                const next = [...withoutDelete];
                next[existingIndex] = nextItem;
                return next;
            }
            return [...withoutDelete, nextItem];
        });
        console.log('[savedInterfaces] remote_outbox_enqueue op=upsert id=%s reason=%s', record.id, reason);
        scheduleRemoteOutboxDrain(0);
    }, [scheduleRemoteOutboxDrain, updateRemoteOutbox]);
    const enqueueRemoteDelete = React.useCallback((id: string, reason: string) => {
        if (!remoteSyncEnabledRef.current) return;
        const identityKey = authIdentityKeyRef.current;
        updateRemoteOutbox((current) => {
            const filtered = current.filter((entry) => !(entry.identityKey === identityKey && entry.clientInterfaceId === id));
            return [
                ...filtered,
                {
                    id: `${identityKey}:delete:${id}:${Date.now()}`,
                    identityKey,
                    op: 'delete',
                    clientInterfaceId: id,
                    attempt: 0,
                    nextRetryAt: Date.now(),
                    createdAt: Date.now(),
                },
            ];
        });
        console.log('[savedInterfaces] remote_outbox_enqueue op=delete id=%s reason=%s', id, reason);
        scheduleRemoteOutboxDrain(0);
    }, [scheduleRemoteOutboxDrain, updateRemoteOutbox]);

    React.useEffect(() => {
        remoteSyncEnabledRef.current = isLoggedIn;
        if (!isLoggedIn) {
            scheduleRemoteOutboxDrain(-1);
            return;
        }
        remoteOutboxPausedUntilRef.current = 0;
        scheduleRemoteOutboxDrain(0);
    }, [isLoggedIn, scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        const onOnline = () => {
            remoteOutboxPausedUntilRef.current = 0;
            scheduleRemoteOutboxDrain(0);
        };
        window.addEventListener('online', onOnline);
        return () => {
            window.removeEventListener('online', onOnline);
        };
    }, [scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        return () => {
            scheduleRemoteOutboxDrain(-1);
        };
    }, [scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        if (!authIdentityKey) return;
        if (prevIdentityKeyRef.current === authIdentityKey) return;
        prevIdentityKeyRef.current = authIdentityKey;
        authIdentityKeyRef.current = authIdentityKey;
        syncEpochRef.current += 1;
        remoteSyncEnabledRef.current = isLoggedIn;

        const nextStorageKey = isLoggedIn && authStorageId
            ? buildSavedInterfacesStorageKeyForUser(authStorageId)
            : SAVED_INTERFACES_KEY;
        if (lastIdentityKeySession !== authIdentityKey) {
            lastIdentityKeySession = authIdentityKey;
            hydratedStorageKeysSession.delete(nextStorageKey);
            backfilledStorageKeysSession.delete(nextStorageKey);
        }
        if (activeStorageKeyRef.current !== nextStorageKey) {
            setSavedInterfacesStorageKey(nextStorageKey);
            activeStorageKeyRef.current = nextStorageKey;
        }
        remoteOutboxStorageKeyRef.current = buildRemoteOutboxStorageKey(authIdentityKey);
        if (canUseBrowserStorage()) {
            const rawOutbox = window.localStorage.getItem(remoteOutboxStorageKeyRef.current);
            remoteOutboxRef.current = parseRemoteOutbox(rawOutbox, authIdentityKey);
        } else {
            remoteOutboxRef.current = [];
        }
        remoteOutboxPausedUntilRef.current = 0;
        scheduleRemoteOutboxDrain(isLoggedIn ? 0 : -1);
        hydratedStorageKeyRef.current = null;
        backfilledStorageKeyRef.current = null;
        lastSyncedStampByIdRef.current.clear();
        remoteKnownUpdatedAtByIdRef.current.clear();
        setPendingLoadInterface(null);
        setPendingAnalysis(null);
        closeDeleteConfirm();
        resetSearchUi();
        refreshSavedInterfaces();
        console.log('[savedInterfaces] identity_switched identity=%s key=%s', authIdentityKey, nextStorageKey);
    }, [
        activeStorageKeyRef,
        authIdentityKey,
        authStorageId,
        closeDeleteConfirm,
        isLoggedIn,
        refreshSavedInterfaces,
        resetSearchUi,
        scheduleRemoteOutboxDrain,
        setPendingAnalysis,
        setPendingLoadInterface,
    ]);

    React.useEffect(() => {
        refreshSavedInterfaces();
    }, [refreshSavedInterfaces]);

    React.useEffect(() => {
        if (!isAuthReady || !isLoggedIn) return;
        const storageKey = activeStorageKeyRef.current;
        if (!storageKey) return;
        if (hydratedStorageKeyRef.current === storageKey || hydratedStorageKeysSession.has(storageKey)) return;
        hydratedStorageKeyRef.current = storageKey;
        hydratedStorageKeysSession.add(storageKey);

        let cancelled = false;
        const epochAtStart = syncEpochRef.current;
        const identityAtStart = authIdentityKeyRef.current;
        void (async () => {
            try {
                const localRecords = loadSavedInterfacesFn();
                const remoteItems = await listSavedInterfaces();
                if (cancelled) return;
                if (syncEpochRef.current !== epochAtStart) return;
                if (authIdentityKeyRef.current !== identityAtStart) return;
                if (activeStorageKeyRef.current !== storageKey) return;

                const remoteRecords: SavedInterfaceRecordV1[] = [];
                const remoteById = new Map<string, SavedInterfaceRecordV1>();
                for (const item of remoteItems) {
                    // Ordering truth is payloadJson.updatedAt, not DB row updated_at.
                    // DB upsert updates row timestamp on rename, which would reorder unexpectedly.
                    const parsed = parseSavedInterfaceRecord(item.payloadJson);
                    if (!parsed) {
                        console.warn('[savedInterfaces] remote_payload_invalid_skipped id=%s', item.clientInterfaceId);
                        continue;
                    }
                    if (import.meta.env.DEV) {
                        const dbUpdatedAtMs = parseIsoMs(item.dbUpdatedAt);
                        if (dbUpdatedAtMs !== null && Math.abs(dbUpdatedAtMs - parsed.updatedAt) > 1000) {
                            console.log(
                                '[savedInterfaces] db_ts_diverges_ignored id=%s db_updated_at=%d payload_updatedAt=%d',
                                parsed.id,
                                dbUpdatedAtMs,
                                parsed.updatedAt
                            );
                        }
                    }
                    remoteRecords.push(parsed);
                    remoteById.set(parsed.id, parsed);
                    lastSyncedStampByIdRef.current.set(parsed.id, buildSyncStamp(parsed));
                    remoteKnownUpdatedAtByIdRef.current.set(parsed.id, parsed.updatedAt);
                }

                const mergedById = new Map<string, SavedInterfaceRecordV1>();
                for (const localRecord of localRecords) {
                    mergedById.set(localRecord.id, localRecord);
                }
                for (const remoteRecord of remoteRecords) {
                    const existing = mergedById.get(remoteRecord.id);
                    if (!existing) {
                        mergedById.set(remoteRecord.id, remoteRecord);
                        continue;
                    }
                    if (remoteRecord.updatedAt >= existing.updatedAt) {
                        mergedById.set(remoteRecord.id, remoteRecord);
                    }
                }

                const merged = sortAndCapSavedInterfaces(Array.from(mergedById.values()));
                const reloaded = commitHydrateMerge(merged);
                if (cancelled) return;
                if (syncEpochRef.current !== epochAtStart) return;
                if (authIdentityKeyRef.current !== identityAtStart) return;
                if (activeStorageKeyRef.current !== storageKey) return;
                console.log('[savedInterfaces] hydrate_merge_ok local=%d remote=%d merged=%d', localRecords.length, remoteRecords.length, reloaded.length);

                if (backfilledStorageKeyRef.current === storageKey || backfilledStorageKeysSession.has(storageKey)) {
                    return;
                }
                backfilledStorageKeyRef.current = storageKey;
                backfilledStorageKeysSession.add(storageKey);

                let queued = 0;
                for (const record of reloaded) {
                    if (queued >= REMOTE_BACKFILL_LIMIT) break;
                    const remoteRecord = remoteById.get(record.id);
                    if (!remoteRecord || record.updatedAt > remoteRecord.updatedAt) {
                        enqueueRemoteUpsert(record, 'login_backfill');
                        queued += 1;
                    }
                }
                if (queued > 0) {
                    console.log('[savedInterfaces] backfill_queued count=%d', queued);
                }
            } catch (error) {
                console.warn('[savedInterfaces] hydrate_remote_failed error=%s', String(error));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [activeStorageKeyRef, commitHydrateMerge, enqueueRemoteUpsert, isAuthReady, isLoggedIn, loadSavedInterfacesFn]);

    return {
        enqueueRemoteUpsert,
        enqueueRemoteDelete,
        syncStatus: {
            draining: remoteOutboxDrainingRef.current,
            pausedUntil: remoteOutboxPausedUntilRef.current,
            hydratedStorageKey: hydratedStorageKeyRef.current,
            activeIdentityKey: authIdentityKeyRef.current,
        },
    };
}
