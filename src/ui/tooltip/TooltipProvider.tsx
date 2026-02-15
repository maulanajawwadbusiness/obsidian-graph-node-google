import React from 'react';
import { createPortal } from 'react-dom';
import { LAYER_TOOLTIP } from '../layers';

type TooltipProviderProps = {
    children: React.ReactNode;
};

const TOOLTIP_PORTAL_ROOT_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: LAYER_TOOLTIP,
    pointerEvents: 'none',
};

const TooltipPortal: React.FC = () => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div data-tooltip-layer-root="1" style={TOOLTIP_PORTAL_ROOT_STYLE} />,
        document.body
    );
};

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => (
    <>
        {children}
        <TooltipPortal />
    </>
);

