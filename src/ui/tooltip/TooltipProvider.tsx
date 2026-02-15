import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';
import { LAYER_TOOLTIP } from '../layers';
import { usePortalBoundsRect, usePortalRootEl, usePortalScopeMode } from '../../components/portalScope/PortalScopeContext';

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

type TooltipSize = {
    width: number;
    height: number;
};

type TooltipComputedPosition = {
    left: number;
    top: number;
    placement: 'top' | 'bottom';
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

const TOOLTIP_PORTAL_ROOT_STYLE_APP: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: LAYER_TOOLTIP,
    pointerEvents: 'none',
};

const TOOLTIP_PORTAL_ROOT_STYLE_CONTAINER: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: LAYER_TOOLTIP,
    pointerEvents: 'none',
};

const TOOLTIP_BUBBLE_STYLE_BASE_APP: React.CSSProperties = {
    position: 'fixed',
    transform: 'translate3d(0,0,0)',
    pointerEvents: 'none',
    fontSize: '8.5px',
    padding: '4.25px 8.5px',
    background: '#0D0D18',
    color: '#E7EEF8',
    borderRadius: '8px',
    border: '1px solid rgba(215, 245, 255, 0.14)',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)',
    lineHeight: 1.35,
    maxWidth: '280px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
};

const TOOLTIP_BUBBLE_STYLE_BASE_CONTAINER: React.CSSProperties = {
    ...TOOLTIP_BUBBLE_STYLE_BASE_APP,
    position: 'absolute',
};

const INITIAL_TOOLTIP_STATE: TooltipState = {
    open: false,
    content: '',
    anchorRect: null,
    placement: 'top',
};

const VIEWPORT_MARGIN = 8;
const TOOLTIP_TOP_GAP = 0;
const TOOLTIP_BOTTOM_GAP = 8;

function toAnchorRect(rect: DOMRect): TooltipAnchorRect {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
}

function computeTooltipPosition(input: {
    anchorRect: TooltipAnchorRect;
    tooltipSize: TooltipSize;
    preferredPlacement: TooltipPlacement;
    mode: 'app' | 'container';
    boundsRect: DOMRect | null;
}): TooltipComputedPosition {
    const { anchorRect, tooltipSize, preferredPlacement, mode, boundsRect } = input;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const vw = mode === 'container' && boundsRect ? boundsRect.width : viewportWidth;
    const vh = mode === 'container' && boundsRect ? boundsRect.height : viewportHeight;
    const anchorLeft = mode === 'container' && boundsRect ? anchorRect.left - boundsRect.left : anchorRect.left;
    const anchorTop = mode === 'container' && boundsRect ? anchorRect.top - boundsRect.top : anchorRect.top;
    const tooltipW = Math.max(0, tooltipSize.width);
    const tooltipH = Math.max(0, tooltipSize.height);

    const topCandidate = anchorTop - TOOLTIP_TOP_GAP - tooltipH;
    const bottomCandidate = anchorTop + anchorRect.height + TOOLTIP_BOTTOM_GAP;

    const canFitTop = topCandidate >= VIEWPORT_MARGIN;
    const canFitBottom = bottomCandidate + tooltipH <= vh - VIEWPORT_MARGIN;

    let placement: 'top' | 'bottom' = 'top';
    if (preferredPlacement === 'top') {
        if (canFitTop) {
            placement = 'top';
        } else if (canFitBottom) {
            placement = 'bottom';
        } else {
            const spaceAbove = anchorTop - VIEWPORT_MARGIN;
            const spaceBelow = vh - VIEWPORT_MARGIN - (anchorTop + anchorRect.height);
            placement = spaceAbove >= spaceBelow ? 'top' : 'bottom';
        }
    }

    const centerX = anchorLeft + anchorRect.width / 2;
    const rawLeft = centerX - tooltipW / 2;
    const maxLeft = Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - tooltipW);
    const left = clamp(rawLeft, VIEWPORT_MARGIN, maxLeft);

    const rawTop = placement === 'top' ? topCandidate : bottomCandidate;
    const maxTop = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - tooltipH);
    const top = clamp(rawTop, VIEWPORT_MARGIN, maxTop);

    return { left, top, placement };
}

const TooltipRenderer: React.FC<{ state: TooltipState; mode: 'app' | 'container'; boundsRect: DOMRect | null }> = ({
    state,
    mode,
    boundsRect,
}) => {
    if (!state.open || !state.anchorRect || state.content.trim().length === 0) return null;
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: 0, height: 0 });
    const resizeRafRef = useRef<number | null>(null);

    const measureBubble = useCallback(() => {
        const el = bubbleRef.current;
        if (!el) return;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        setTooltipSize((prev) => {
            if (prev.width === width && prev.height === height) return prev;
            return { width, height };
        });
    }, []);

    useLayoutEffect(() => {
        measureBubble();
    }, [measureBubble, state.anchorRect, state.content, state.open]);

    useEffect(() => {
        if (!state.open || !bubbleRef.current) return;
        if (typeof ResizeObserver === 'undefined') return;

        const scheduleMeasure = () => {
            if (resizeRafRef.current !== null) return;
            resizeRafRef.current = window.requestAnimationFrame(() => {
                resizeRafRef.current = null;
                measureBubble();
            });
        };

        const observer = new ResizeObserver(() => {
            scheduleMeasure();
        });
        observer.observe(bubbleRef.current);
        return () => {
            observer.disconnect();
            if (resizeRafRef.current !== null) {
                window.cancelAnimationFrame(resizeRafRef.current);
                resizeRafRef.current = null;
            }
        };
    }, [measureBubble, state.open]);

    const computed = computeTooltipPosition({
        anchorRect: state.anchorRect,
        tooltipSize,
        preferredPlacement: state.placement,
        mode,
        boundsRect,
    });

    return (
        <div
            ref={bubbleRef}
            data-tooltip-instance="1"
            data-tooltip-placement={computed.placement}
            style={{
                ...(mode === 'container' ? TOOLTIP_BUBBLE_STYLE_BASE_CONTAINER : TOOLTIP_BUBBLE_STYLE_BASE_APP),
                left: `${computed.left}px`,
                top: `${computed.top}px`,
            }}
        >
            {state.content}
        </div>
    );
};

const TooltipPortal: React.FC<{ state: TooltipState }> = ({ state }) => {
    const portalRoot = usePortalRootEl();
    const mode = usePortalScopeMode();
    const boundsRect = usePortalBoundsRect();
    return createPortal(
        <div
            data-tooltip-layer-root="1"
            style={mode === 'container' ? TOOLTIP_PORTAL_ROOT_STYLE_CONTAINER : TOOLTIP_PORTAL_ROOT_STYLE_APP}
        >
            <TooltipRenderer state={state} mode={mode} boundsRect={boundsRect} />
        </div>,
        portalRoot
    );
};

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
    const [state, setState] = useState<TooltipState>(INITIAL_TOOLTIP_STATE);
    const anchorElRef = useRef<Element | null>(null);
    const anchorUpdateRafRef = useRef<number | null>(null);
    const anchorUpdateScheduledRef = useRef(false);

    const updateAnchorRectFromAnchorEl = useCallback(() => {
        const anchorEl = anchorElRef.current;
        if (!anchorEl) return;
        if (!anchorEl.isConnected) return;
        const nextRect = toAnchorRect(anchorEl.getBoundingClientRect());
        setState((prev) => {
            if (!prev.open || !prev.anchorRect) return prev;
            const sameRect =
                prev.anchorRect.left === nextRect.left &&
                prev.anchorRect.top === nextRect.top &&
                prev.anchorRect.width === nextRect.width &&
                prev.anchorRect.height === nextRect.height;
            if (sameRect) return prev;
            return {
                ...prev,
                anchorRect: nextRect,
            };
        });
    }, []);

    const scheduleAnchorRectUpdate = useCallback(() => {
        if (anchorUpdateScheduledRef.current) return;
        anchorUpdateScheduledRef.current = true;
        anchorUpdateRafRef.current = window.requestAnimationFrame(() => {
            anchorUpdateScheduledRef.current = false;
            anchorUpdateRafRef.current = null;
            updateAnchorRectFromAnchorEl();
        });
    }, [updateAnchorRectFromAnchorEl]);

    const hideTooltip = useCallback(() => {
        anchorElRef.current = null;
        if (anchorUpdateRafRef.current !== null) {
            window.cancelAnimationFrame(anchorUpdateRafRef.current);
            anchorUpdateRafRef.current = null;
            anchorUpdateScheduledRef.current = false;
        }
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
            anchorElRef.current = null;
            resolvedRect = input.anchorRect;
        } else if (input.anchorEl) {
            anchorElRef.current = input.anchorEl;
            resolvedRect = toAnchorRect(input.anchorEl.getBoundingClientRect());
        } else {
            anchorElRef.current = null;
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

    useEffect(() => {
        if (!state.open) return;
        if (!anchorElRef.current) return;

        const handleViewportChange = () => {
            scheduleAnchorRectUpdate();
        };

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        let anchorObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && anchorElRef.current) {
            anchorObserver = new ResizeObserver(() => {
                scheduleAnchorRectUpdate();
            });
            anchorObserver.observe(anchorElRef.current);
        }

        scheduleAnchorRectUpdate();

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            if (anchorObserver) {
                anchorObserver.disconnect();
            }
            if (anchorUpdateRafRef.current !== null) {
                window.cancelAnimationFrame(anchorUpdateRafRef.current);
                anchorUpdateRafRef.current = null;
                anchorUpdateScheduledRef.current = false;
            }
        };
    }, [scheduleAnchorRectUpdate, state.open]);

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
