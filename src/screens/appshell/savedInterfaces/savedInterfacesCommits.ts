import React from 'react';
import { SavedInterfaceRecordV1 } from '../../../store/savedInterfacesStore';

type SavedInterfacesCommitContext = {
    getSavedInterfaces: () => SavedInterfaceRecordV1[];
    applySavedInterfacesState: (next: SavedInterfaceRecordV1[]) => SavedInterfaceRecordV1[];
    setPendingLoadInterface: React.Dispatch<React.SetStateAction<SavedInterfaceRecordV1 | null>>;
    enqueueRemoteUpsert: (record: SavedInterfaceRecordV1, reason: string) => void;
    enqueueRemoteDelete: (id: string, reason: string) => void;
    isRestoreReadPathActive: () => boolean;
    isDev: boolean;
    now?: () => number;
};

export type SavedInterfacesCommitSurfaces = {
    commitUpsertInterface: (record: SavedInterfaceRecordV1, reason: string) => void;
    commitPatchLayoutByDocId: (
        docId: string,
        layout: SavedInterfaceRecordV1['layout'],
        camera: SavedInterfaceRecordV1['camera'],
        reason: string
    ) => void;
    commitDeleteInterface: (id: string, reason: string) => void;
    commitRenameInterface: (id: string, newTitle: string, reason: string) => void;
    commitHydrateMerge: (merged: SavedInterfaceRecordV1[]) => SavedInterfaceRecordV1[];
};

export function createSavedInterfacesCommitSurfaces(
    ctx: SavedInterfacesCommitContext
): SavedInterfacesCommitSurfaces {
    const getNow = ctx.now ?? Date.now;

    const commitUpsertInterface = (record: SavedInterfaceRecordV1, reason: string) => {
        if (ctx.isRestoreReadPathActive()) {
            if (ctx.isDev) {
                console.log('[savedInterfaces] restore_write_blocked op=upsert id=%s reason=%s', record.id, reason);
            }
            return;
        }
        if (reason.startsWith('restore_')) {
            if (ctx.isDev) {
                console.log('[savedInterfaces] restore_write_blocked op=upsert id=%s reason=%s', record.id, reason);
            }
            return;
        }
        const nowMs = getNow();
        const current = ctx.getSavedInterfaces();
        const existingIndex = current.findIndex((item) => item.dedupeKey === record.dedupeKey);
        let committed: SavedInterfaceRecordV1;
        let next: SavedInterfaceRecordV1[];
        if (existingIndex >= 0) {
            const existing = current[existingIndex];
            committed = {
                ...record,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: nowMs,
            };
            next = [
                committed,
                ...current.filter((_, index) => index !== existingIndex),
            ];
        } else {
            committed = {
                ...record,
                createdAt: Number.isFinite(record.createdAt) ? record.createdAt : nowMs,
                updatedAt: nowMs,
            };
            next = [committed, ...current];
        }
        ctx.applySavedInterfacesState(next);
        ctx.enqueueRemoteUpsert(committed, reason);
    };

    const commitPatchLayoutByDocId = (
        docId: string,
        layout: SavedInterfaceRecordV1['layout'],
        camera: SavedInterfaceRecordV1['camera'],
        reason: string
    ) => {
        if (ctx.isRestoreReadPathActive()) {
            if (ctx.isDev) {
                console.log('[savedInterfaces] restore_write_blocked op=layout_patch docId=%s reason=%s', docId, reason);
            }
            return;
        }
        if (reason.startsWith('restore_')) {
            if (ctx.isDev) {
                console.log('[savedInterfaces] restore_write_blocked op=layout_patch docId=%s reason=%s', docId, reason);
            }
            return;
        }
        if (!docId) return;
        const current = ctx.getSavedInterfaces();
        const index = current.findIndex((item) => item.docId === docId);
        if (index < 0) {
            if (ctx.isDev) {
                console.log('[savedInterfaces] layout_patch_skipped reason=no_target_docId');
            }
            return;
        }
        const next = [...current];
        const existing = next[index];
        const committed: SavedInterfaceRecordV1 = {
            ...existing,
            layout,
            camera: camera ?? existing.camera,
        };
        next[index] = committed;
        ctx.applySavedInterfacesState(next);
        ctx.enqueueRemoteUpsert(committed, reason);
    };

    const commitDeleteInterface = (id: string, reason: string) => {
        const current = ctx.getSavedInterfaces();
        const next = current.filter((item) => item.id !== id);
        ctx.applySavedInterfacesState(next);
        ctx.setPendingLoadInterface((curr) => (curr?.id === id ? null : curr));
        ctx.enqueueRemoteDelete(id, reason);
    };

    const commitRenameInterface = (id: string, newTitle: string, reason: string) => {
        const current = ctx.getSavedInterfaces();
        const index = current.findIndex((item) => item.id === id);
        if (index < 0) {
            if (ctx.isDev) {
                console.log('[savedInterfaces] title_patch_skipped reason=not_found');
            }
            return;
        }
        const next = [...current];
        const existing = next[index];
        const committed: SavedInterfaceRecordV1 = {
            ...existing,
            title: newTitle,
        };
        next[index] = committed;
        ctx.applySavedInterfacesState(next);
        ctx.enqueueRemoteUpsert(committed, reason);
    };

    const commitHydrateMerge = (merged: SavedInterfaceRecordV1[]) => {
        return ctx.applySavedInterfacesState(merged);
    };

    return {
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        commitDeleteInterface,
        commitRenameInterface,
        commitHydrateMerge,
    };
}
