/**
 * Node Popup System Types
 * State and geometry interfaces for popup system
 */

export type PopupMode = 'normal' | 'chatbar' | 'seed';

export interface AnchorGeometry {
    x: number;      // Screen X of node center
    y: number;      // Screen Y of node center  
    radius: number; // Screen radius
}

export interface PopupState {
    isOpen: boolean;
    mode: PopupMode;
    selectedNodeId: string | null;
    anchorGeometry: AnchorGeometry | null;
}

export interface PopupActions {
    openPopup: (nodeId: string, geometry: AnchorGeometry) => void;
    closePopup: () => void;
    switchToNode: (nodeId: string, geometry: AnchorGeometry) => void;
}

export type PopupContextValue = PopupState & PopupActions;
