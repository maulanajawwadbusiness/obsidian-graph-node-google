import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LAYER_TOOLTIP } from '../layers';

type TooltipProviderProps = {
    children: React.ReactNode;
};

type TooltipAnchorRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type TooltipPlacement = 'top';

type TooltipState = {
    open: boolean;
    content: string;
    anchorRect: TooltipAnchorRect | null;
    placement: TooltipPlacement;
    sourceId?: string;
};

type ShowTooltipInput = {
    content: string;
    anchorEl?: Element | null;
    anchorRect?: TooltipAnchorRect;
    placement?: TooltipPlacement;
    sourceId?: string;
};

type TooltipControllerContextValue = {
    showTooltip: (input: ShowTooltipInput) => void;
    hideTooltip: () => void;
    isOpen: boolean;
};

const TooltipControllerContext = createContext<TooltipControllerContextValue | null>(null);

const TOOLTIP_PORTAL_ROOT_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: LAYER_TOOLTIP,
    pointerEvents: 'none',
};

const TOOLTIP_BUBBLE_STYLE_BASE: React.CSSProperties = {
    position: 'fixed',
    transform: 'translate(-50%, -100%)',
    pointerEvents: 'none',
    fontSize: '10px',
    padding: '10px',
    background: '#0D0D18',
    color: '#D7F5FF',
    borderRadius: '6px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
};

const INITIAL_TOOLTIP_STATE: TooltipState = {
    open: false,
    content: '',
    anchorRect: null,
    placement: 'top',
};

function toAnchorRect(rect: DOMRect): TooltipAnchorRect {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

const TooltipRenderer: React.FC<{ state: TooltipState }> = ({ state }) => {
    if (!state.open || !state.anchorRect || state.content.trim().length === 0) return null;
    const x = state.anchorRect.left + state.anchorRect.width / 2;
    const y = state.anchorRect.top;
    return (
        <div
            data-tooltip-instance="1"
            style={{
                ...TOOLTIP_BUBBLE_STYLE_BASE,
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            {state.content}
        </div>
    );
};

const TooltipPortal: React.FC<{ state: TooltipState }> = ({ state }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div data-tooltip-layer-root="1" style={TOOLTIP_PORTAL_ROOT_STYLE}>
            <TooltipRenderer state={state} />
        </div>,
        document.body
    );
};

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
    const [state, setState] = useState<TooltipState>(INITIAL_TOOLTIP_STATE);

    const hideTooltip = useCallback(() => {
        setState((prev) => {
            if (!prev.open && prev.content === '' && prev.anchorRect === null) return prev;
            return {
                ...prev,
                open: false,
                content: '',
                anchorRect: null,
            };
        });
    }, []);

    const showTooltip = useCallback((input: ShowTooltipInput) => {
        const content = input.content.trim();
        if (!content) return;

        let resolvedRect: TooltipAnchorRect | null = null;
        if (input.anchorRect) {
            resolvedRect = input.anchorRect;
        } else if (input.anchorEl) {
            resolvedRect = toAnchorRect(input.anchorEl.getBoundingClientRect());
        }

        if (!resolvedRect) return;

        setState({
            open: true,
            content,
            anchorRect: resolvedRect,
            placement: input.placement ?? 'top',
            sourceId: input.sourceId,
        });
    }, []);

    const controllerValue = useMemo<TooltipControllerContextValue>(() => ({
        showTooltip,
        hideTooltip,
        isOpen: state.open,
    }), [hideTooltip, showTooltip, state.open]);

    return (
        <TooltipControllerContext.Provider value={controllerValue}>
            {children}
            <TooltipPortal state={state} />
        </TooltipControllerContext.Provider>
    );
};

export function useTooltipController(): TooltipControllerContextValue {
    const ctx = useContext(TooltipControllerContext);
    if (!ctx) {
        throw new Error('useTooltipController must be used within TooltipProvider');
    }
    return ctx;
}
