import React from 'react';
import { hideShortage, useShortageStore } from '../money/shortageStore';

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

const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

export const ChatShortageNotif: React.FC<ChatShortageNotifProps> = ({ surface, anchorRef, zIndex = 1003 }) => {
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
            const maxLeft = Math.max(EDGE_MARGIN, window.innerWidth - notifRect.width - EDGE_MARGIN);
            const centeredLeft = anchorRect.left + anchorRect.width / 2 - notifRect.width / 2;
            const left = clamp(centeredLeft, EDGE_MARGIN, maxLeft);

            let top = anchorRect.bottom + ANCHOR_GAP;
            if (top + notifRect.height > window.innerHeight - EDGE_MARGIN) {
                top = anchorRect.top - notifRect.height - ANCHOR_GAP;
            }
            const maxTop = Math.max(EDGE_MARGIN, window.innerHeight - notifRect.height - EDGE_MARGIN);
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
    }, [anchorRef, isVisible, token]);

    if (!isVisible) {
        return null;
    }

    return (
        <div
            ref={notifRef}
            style={{
                ...BASE_STYLE,
                left: `${position.left}px`,
                top: `${position.top}px`,
                zIndex,
                opacity: position.ready ? 1 : 0,
            }}
            onPointerDown={stopPropagation}
            onWheel={stopPropagation}
        >
            Saldo tidak cukup untuk chat
        </div>
    );
};
