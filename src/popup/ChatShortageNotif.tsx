import React from 'react';
import { hideShortage, useShortageStore } from '../money/shortageStore';
import { usePortalBoundsRect, usePortalScopeMode } from '../components/portalScope/PortalScopeContext';
import {
    shouldAllowOverlayWheelDefault,
    SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_ATTR,
    SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_VALUE,
} from '../components/sampleGraphPreviewSeams';
import { useGraphViewport } from '../runtime/viewport/graphViewport';
import { getViewportSize, isBoxedViewport, recordBoxedClampCall, toViewportLocalPoint } from '../runtime/viewport/viewportMath';

type AnchoredShortageSurface = 'node-popup' | 'mini-chat';

type Position = {
    left: number;
    top: number;
    ready: boolean;
};

type ChatShortageNotifProps = {
    surface: AnchoredShortageSurface;
    anchorRef: React.RefObject<HTMLElement>;
    zIndex?: number;
};

const AUTO_HIDE_MS = 3000;
const EDGE_MARGIN = 10;
const ANCHOR_GAP = 8;

const BASE_STYLE: React.CSSProperties = {
    position: 'fixed',
    maxWidth: '280px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(12, 14, 18, 0.95)',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    lineHeight: 1.4,
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    pointerEvents: 'auto',
    opacity: 0,
    transition: 'opacity 120ms ease',
};

const BASE_STYLE_CONTAINER: React.CSSProperties = {
    ...BASE_STYLE,
    position: 'absolute',
};

const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
};
const stopOverlayWheelPropagation = (event: React.WheelEvent) => {
    event.stopPropagation();
    const allowOverlayDefault = shouldAllowOverlayWheelDefault({
        target: event.target,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
    });
    if (!allowOverlayDefault) {
        event.preventDefault();
    }
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

export const ChatShortageNotif: React.FC<ChatShortageNotifProps> = ({ surface, anchorRef, zIndex = 1003 }) => {
    const portalMode = usePortalScopeMode();
    const portalBoundsRect = usePortalBoundsRect();
    const viewport = useGraphViewport();
    const { open, context, surface: shortageSurface, token } = useShortageStore();
    const notifRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState<Position>({ left: -9999, top: -9999, ready: false });

    const isVisible = open && context === 'chat' && shortageSurface === surface;

    React.useEffect(() => {
        if (!isVisible) return;

        const hideTimer = window.setTimeout(() => {
            hideShortage();
        }, AUTO_HIDE_MS);

        return () => {
            window.clearTimeout(hideTimer);
        };
    }, [isVisible, token]);

    React.useLayoutEffect(() => {
        if (!isVisible) {
            setPosition((prev) => {
                if (prev.left === -9999 && prev.top === -9999 && !prev.ready) {
                    return prev;
                }
                return { left: -9999, top: -9999, ready: false };
            });
            return;
        }

        let rafId = 0;

        const updatePosition = () => {
            const anchorEl = anchorRef.current;
            const notifEl = notifRef.current;
            if (!anchorEl || !notifEl) return;

            const anchorRect = anchorEl.getBoundingClientRect();
            const notifRect = notifEl.getBoundingClientRect();
            const boxed = isBoxedViewport(viewport);
            if (boxed) {
                recordBoxedClampCall();
            }
            const fallbackW = boxed
                ? (portalBoundsRect?.width ?? viewport.width ?? 1)
                : (portalMode === 'container' && portalBoundsRect ? portalBoundsRect.width : window.innerWidth);
            const fallbackH = boxed
                ? (portalBoundsRect?.height ?? viewport.height ?? 1)
                : (portalMode === 'container' && portalBoundsRect ? portalBoundsRect.height : window.innerHeight);
            const { w: viewportWidth, h: viewportHeight } = getViewportSize(viewport, fallbackW, fallbackH);
            const anchorLocal = boxed
                ? toViewportLocalPoint(anchorRect.left, anchorRect.top, viewport)
                : {
                    x: portalMode === 'container' && portalBoundsRect ? anchorRect.left - portalBoundsRect.left : anchorRect.left,
                    y: portalMode === 'container' && portalBoundsRect ? anchorRect.top - portalBoundsRect.top : anchorRect.top,
                };
            const anchorLeft = anchorLocal.x;
            const anchorTop = anchorLocal.y;
            const maxLeft = Math.max(EDGE_MARGIN, viewportWidth - notifRect.width - EDGE_MARGIN);
            const centeredLeft = anchorLeft + anchorRect.width / 2 - notifRect.width / 2;
            const left = clamp(centeredLeft, EDGE_MARGIN, maxLeft);

            let top = anchorTop + anchorRect.height + ANCHOR_GAP;
            if (top + notifRect.height > viewportHeight - EDGE_MARGIN) {
                top = anchorTop - notifRect.height - ANCHOR_GAP;
            }
            const maxTop = Math.max(EDGE_MARGIN, viewportHeight - notifRect.height - EDGE_MARGIN);
            top = clamp(top, EDGE_MARGIN, maxTop);

            setPosition({ left, top, ready: true });
        };

        const scheduleUpdate = () => {
            if (rafId) {
                window.cancelAnimationFrame(rafId);
            }
            rafId = window.requestAnimationFrame(updatePosition);
        };

        scheduleUpdate();

        window.addEventListener('resize', scheduleUpdate);
        window.addEventListener('scroll', scheduleUpdate, true);
        window.addEventListener('graph-render-tick', scheduleUpdate);

        return () => {
            if (rafId) {
                window.cancelAnimationFrame(rafId);
            }
            window.removeEventListener('resize', scheduleUpdate);
            window.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('graph-render-tick', scheduleUpdate);
        };
    }, [anchorRef, isVisible, token, portalMode, portalBoundsRect, viewport]);

    if (!isVisible) {
        return null;
    }

    return (
        <div
            ref={notifRef}
            {...{ [SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_ATTR]: SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_VALUE }}
            style={{
                ...BASE_STYLE,
                ...(portalMode === 'container' ? BASE_STYLE_CONTAINER : null),
                left: `${position.left}px`,
                top: `${position.top}px`,
                zIndex,
                opacity: position.ready ? 1 : 0,
            }}
            onPointerDownCapture={stopPropagation}
            onPointerDown={stopPropagation}
            onWheelCapture={stopOverlayWheelPropagation}
            onWheel={stopPropagation}
        >
            Saldo tidak cukup untuk chat
        </div>
    );
};
