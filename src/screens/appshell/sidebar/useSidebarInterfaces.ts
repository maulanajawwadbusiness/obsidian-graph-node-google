import React from 'react';
import { SidebarInterfaceItem } from '../../../components/Sidebar';
import { SavedInterfaceRecordV1 } from '../../../store/savedInterfacesStore';

export function useSidebarInterfaces(savedInterfaces: SavedInterfaceRecordV1[]): SidebarInterfaceItem[] {
    return React.useMemo(
        () =>
            savedInterfaces.map((record) => ({
                id: record.id,
                title: record.title,
                subtitle: new Date(record.updatedAt).toLocaleString(),
                nodeCount: record.preview.nodeCount,
                linkCount: record.preview.linkCount,
                updatedAt: record.updatedAt,
            })),
        [savedInterfaces]
    );
}
