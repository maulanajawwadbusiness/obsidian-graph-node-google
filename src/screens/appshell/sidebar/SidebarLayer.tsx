import React from 'react';
import { Sidebar, SidebarInterfaceItem } from '../../../components/Sidebar';

type SidebarLayerProps = {
    show: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onCreateNew: () => void;
    onOpenSearchInterfaces: () => void;
    disabled: boolean;
    showDocumentViewerButton: boolean;
    onToggleDocumentViewer: () => void;
    interfaces: SidebarInterfaceItem[];
    onRenameInterface: (id: string, newTitle: string) => void;
    onDeleteInterface: (id: string) => void;
    selectedInterfaceId?: string;
    onSelectInterface: (id: string) => void;
    accountName?: string;
    accountImageUrl?: string;
    onOpenProfile?: () => void;
    onRequestLogout?: () => void;
};

export function SidebarLayer(props: SidebarLayerProps): React.ReactElement | null {
    const {
        show,
        isExpanded,
        onToggle,
        onCreateNew,
        onOpenSearchInterfaces,
        disabled,
        showDocumentViewerButton,
        onToggleDocumentViewer,
        interfaces,
        onRenameInterface,
        onDeleteInterface,
        selectedInterfaceId,
        onSelectInterface,
        accountName,
        accountImageUrl,
        onOpenProfile,
        onRequestLogout,
    } = props;
    if (!show) return null;

    return (
        <Sidebar
            isExpanded={isExpanded}
            onToggle={onToggle}
            onCreateNew={onCreateNew}
            onOpenSearchInterfaces={onOpenSearchInterfaces}
            disabled={disabled}
            showDocumentViewerButton={showDocumentViewerButton}
            onToggleDocumentViewer={onToggleDocumentViewer}
            interfaces={interfaces}
            onRenameInterface={onRenameInterface}
            onDeleteInterface={onDeleteInterface}
            selectedInterfaceId={selectedInterfaceId}
            onSelectInterface={onSelectInterface}
            accountName={accountName}
            accountImageUrl={accountImageUrl}
            onOpenProfile={onOpenProfile}
            onRequestLogout={onRequestLogout}
        />
    );
}
