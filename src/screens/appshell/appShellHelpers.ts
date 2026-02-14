import { DEFAULT_SAVED_INTERFACES_CAP, SavedInterfaceRecordV1 } from '../../store/savedInterfacesStore';

export function resolveAuthStorageId(user: unknown): string | null {
    if (!user || typeof user !== 'object') return null;
    const typed = user as Record<string, unknown>;
    const rawId = typed.id;
    if (typeof rawId === 'string' && rawId.trim().length > 0) {
        return `id_${rawId.trim()}`;
    }
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
        return `id_${rawId}`;
    }
    const rawSub = typed.sub;
    if (typeof rawSub === 'string' && rawSub.trim().length > 0) {
        return `sub_${rawSub.trim()}`;
    }
    return null;
}

export function sortAndCapSavedInterfaces(
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
