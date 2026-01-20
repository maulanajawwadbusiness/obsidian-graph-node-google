import { createContext, useContext, useState, ReactNode } from 'react';
import type { PopupState, PopupContextValue, AnchorGeometry } from './popupTypes';

/**
 * Popup Store - React Context for managing popup state
 */

const initialState: PopupState = {
    isOpen: false,
    mode: 'normal',
    selectedNodeId: null,
    anchorGeometry: null,
};

const PopupContext = createContext<PopupContextValue | null>(null);

export function PopupProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PopupState>(initialState);

    const openPopup = (nodeId: string, geometry: AnchorGeometry) => {
        console.log('[Popup] Opening for node:', nodeId);
        setState({
            isOpen: true,
            mode: 'normal',
            selectedNodeId: nodeId,
            anchorGeometry: geometry,
        });
    };

    const closePopup = () => {
        console.log('[Popup] Closing');
        setState(initialState);
    };

    const switchToNode = (nodeId: string, geometry: AnchorGeometry) => {
        console.log('[Popup] Switching to node:', nodeId);
        setState({
            ...state,
            selectedNodeId: nodeId,
            anchorGeometry: geometry,
        });
    };

    const contextValue: PopupContextValue = {
        ...state,
        openPopup,
        closePopup,
        switchToNode,
    };

    return (
        <PopupContext.Provider value={contextValue}>
            {children}
        </PopupContext.Provider>
    );
}

export function usePopup(): PopupContextValue {
    const context = useContext(PopupContext);
    if (!context) {
        throw new Error('usePopup must be used within PopupProvider');
    }
    return context;
}
