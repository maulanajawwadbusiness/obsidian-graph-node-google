import React, { useEffect, useRef, useState } from 'react';
import { usePopup } from './PopupStore';
import { ChatInput } from './ChatInput';
import { t } from '../i18n/t';

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const GAP_FROM_NODE = 20;

// MEMBRANE ANIMATION - Initial (hidden) state
const POPUP_STYLE: React.CSSProperties = {
    position: 'absolute',
    width: '20vw',
    minWidth: '280px',
    height: '80vh',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    border: 'none',
    borderRadius: '8px',
    padding: '20px',
    color: 'rgba(180, 190, 210, 0.9)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(0px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0)',
    pointerEvents: 'auto',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    transition: `
    opacity 400ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 350ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 300ms ease-out 100ms,
    backdrop-filter 300ms ease-out,
    box-shadow 400ms ease-out 50ms
  `,
    opacity: 0,
    transform: 'scale(0.8)',
    filter: 'blur(8px)',
};

// MEMBRANE ANIMATION - Final (visible) state
const POPUP_VISIBLE_STYLE: React.CSSProperties = {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0px)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
};

const HEADER_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16px',
    marginBottom: '4px',
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'rgba(180, 190, 210, 0.7)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
};

const CONTENT_STYLE: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    fontSize: '14px',
    lineHeight: '1.6',
};

const LABEL_STYLE: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: 'rgba(99, 171, 255, 0.9)',
};

function computePopupPosition(
    anchor: { x: number; y: number; radius: number },
    popupWidth: number,
    popupHeight: number
): { left: number; top: number; originX: number; originY: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left: number;
    if (anchor.x > viewportWidth / 2) {
        left = anchor.x - anchor.radius - GAP_FROM_NODE - popupWidth;
    } else {
        left = anchor.x + anchor.radius + GAP_FROM_NODE;
    }

    const minLeft = 10;
    const maxLeft = viewportWidth - popupWidth - 10;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    let top = anchor.y - popupHeight / 2;
    const minTop = 10;
    const maxTop = viewportHeight - popupHeight - 10;
    top = Math.max(minTop, Math.min(top, maxTop));

    // Origin relative to popup's top-left corner
    const originX = anchor.x - left;
    const originY = anchor.y - top;

    return { left, top, originX, originY };
    return { left, top, originX, originY };
}

interface NodePopupProps {
    trackNode?: (nodeId: string) => { x: number; y: number; radius: number } | null;
}

export const NodePopup: React.FC<NodePopupProps> = ({ trackNode }) => {
    const { selectedNodeId, anchorGeometry, closePopup, sendMessage, setPopupRect, content } = usePopup();
    const popupRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);

    // Staged reveal: container first, then content
    useEffect(() => {
        setIsVisible(false);
        setContentVisible(false);
        const containerTimer = setTimeout(() => setIsVisible(true), 10);
        const contentTimer = setTimeout(() => setContentVisible(true), 200);
        return () => {
            clearTimeout(containerTimer);
            clearTimeout(contentTimer);
        };
    }, [selectedNodeId]);

    const position = anchorGeometry
        ? computePopupPosition(
            anchorGeometry,
            popupRef.current?.offsetWidth || 280,
            popupRef.current?.offsetHeight || window.innerHeight * 0.8
        )
        : { left: 0, top: 0, originX: 0, originY: 0 };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closePopup();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closePopup]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                closePopup();
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [closePopup]);

    // Report popup rect for chatbar positioning
    useEffect(() => {
        if (!isVisible) {
            setPopupRect(null);
            return;
        }
        if (!popupRef.current) return;

        const reportRect = () => {
            if (!popupRef.current) return;
            const rect = popupRef.current.getBoundingClientRect();
            setPopupRect({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            });
        };

        reportRect();
        const settleTimer = window.setTimeout(reportRect, 450);
        const handleTransitionEnd = (event: TransitionEvent) => {
            if (event.propertyName === 'transform' || event.propertyName === 'opacity') {
                reportRect();
            }
        };

        const node = popupRef.current;
        node.addEventListener('transitionend', handleTransitionEnd);

        return () => {
            window.clearTimeout(settleTimer);
            node.removeEventListener('transitionend', handleTransitionEnd);
        };
    }, [isVisible, position.left, position.top, setPopupRect]);

    // UI Content
    const displayTitle = content?.title || (selectedNodeId ? t('nodePopup.fallbackTitle', { id: selectedNodeId.slice(0, 8) }) : 'Unknown');
    const displayBody = content?.summary || t('nodePopup.fallbackSummary');

    const contentTransition: React.CSSProperties = contentVisible
        ? { opacity: 1, transform: 'translateY(0)', transition: 'opacity 300ms ease-out, transform 300ms ease-out' }
        : { opacity: 0, transform: 'translateY(8px)', transition: 'opacity 300ms ease-out, transform 300ms ease-out' };

    // Fix 52 & 24: Direct Synchronous Alignment
    // Instead of an internal rAF loop (which lags by 1 frame), we trust that the Parent
    // will re-render "us" OR call `updatePosition` when the node moves.
    // However, NodePopup is a React component. We want to avoid React Render Loop for 60fps motion.
    // So we KEEP `requestAnimationFrame` BUT we ensure it reads the *latest* data.
    // user instruction (Fix 24): "lock overlay cadence to main render".
    // "Remove independent overlay rAF loops".
    // This means we should expose a way for MainLoop to push updates.
    // OR we rely on `trackNode` being called centrally.

    // NEW ARCHITECTURE:
    // `trackNode` acts as the single source of truth.
    // If we use an internal rAF, we risk 1-frame skew if our rAF fires before the Main Loop updates.
    // But `useGraphRendering` is the Main Loop.
    // We can't injected "Main Loop" logic into this View Component easily without refs.

    // Compromise for "No IDE": We will use an internal rAF but verify timing?
    // User explicitly said: "remove independent overlay rAF loops".
    // So we MUST remove this effect.
    // Position updates must come via `trackNode` somehow driving the DOM?
    // OR, we assume `trackNode` call inside the PARENT's rAF is where we should hook?
    // But Parent (Playground) renders React tree. It doesn't rAF render React tree.
    // It has `getFrameSnapshot`.

    // Solution:
    // We attach a ref to `NodePopup`. `NodePopup` exposes `update()` method.
    // Takes `geom` as arg.
    // `GraphPhysicsPlayground` stores this ref.
    // `useGraphRendering` accepts an `onFrame` callback.
    // `GraphPhysicsPlayground` impls `onFrame` -> call `nodePopupRef.current.update()`.

    // So here, we REMOVE the loop. We expose a ref.
    // But since we can't easily change the Component Signature to forwardRef in one diff without breaking interface...
    // Actually we can using `useImperativeHandle`. But parent needs to hold the ref.
    // Constraint: "minimal diff".

    // Alternate Fix: `trackNode` is provided by `useGraphRendering`.
    // If we pass an `onUpdate` callback PROP to `NodePopup`, and `NodePopup` registers itself?
    // "registerUpdateCallback(callback)".

    // Let's implement the "Register Callback" pattern.
    // `trackNode` is the interface.
    // If we attach a `registerUpdater` to `trackNode`? Dirty.

    // Let's go with: `NodePopup` accepts `updateRef` prop?
    // No, `GraphPhysicsPlayground` isn't easily modifiable to pass a new prop without plumbing.

    // Wait, `PopupPortal` has `trackNode`.
    // We can just turn `NodePopup` into a "dumb" component that positions based on props?
    // Then `PopupPortal` manages the rAF?
    // No, `PopupPortal` is also standard React.

    // Let's use a Custom Event dispatch?
    // `window.dispatchEvent(new CustomEvent('graph-render', { detail: { timestamp } }))`
    // `NodePopup` listens to 'graph-render'.
    // Synchronization achieved.
    // `useGraphRendering` dispatches event at end of frame.

    useEffect(() => {
        if (!trackNode || !selectedNodeId || !isVisible) return;

        const handleSync = () => {
            const geom = trackNode(selectedNodeId);
            if (geom && popupRef.current) {
                const width = popupRef.current.offsetWidth;
                const height = popupRef.current.offsetHeight;

                // Fix 23: CSS Pixel Quantization for Transform
                // Snap to integer CSS pixels to avoid sub-pixel blur on transform
                // (Browser handles layout snapping locally, but transform needs help)
                const dpr = window.devicePixelRatio || 1;
                // We use computePopupPosition which outputs floats.
                const rawPos = computePopupPosition(geom, width, height);

                // Quantize final usage
                // round(x * dpr) / dpr
                const snap = (v: number) => Math.round(v * dpr) / dpr;

                const left = snap(rawPos.left);
                const top = snap(rawPos.top);
                const ox = snap(rawPos.originX);
                const oy = snap(rawPos.originY);

                popupRef.current.style.left = `${left}px`;
                popupRef.current.style.top = `${top}px`;
                popupRef.current.style.transformOrigin = `${ox}px ${oy}px`;
            }
        };

        // Listen for the Master Tick
        window.addEventListener('graph-render-tick', handleSync);
        // Also run once now
        handleSync();

        return () => window.removeEventListener('graph-render-tick', handleSync);
    }, [selectedNodeId, trackNode, isVisible]);

    const finalStyle: React.CSSProperties = {
        ...POPUP_STYLE,
        ...(isVisible ? POPUP_VISIBLE_STYLE : {}),
        left: `${position.left}px`,
        top: `${position.top}px`,
        transformOrigin: `${position.originX}px ${position.originY}px`,
    };

    return (
        <div
            ref={popupRef}
            style={finalStyle}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            onClick={stopPropagation}
        >
            <div style={{ ...HEADER_STYLE, ...contentTransition }}>
                <span style={{ fontSize: '14px', opacity: 0.7 }}>{t('nodePopup.header')}</span>
                <button
                    style={CLOSE_BUTTON_STYLE}
                    onClick={closePopup}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(180, 190, 210, 0.7)')}
                    title={t('tooltip.close')}
                >
                    ×
                </button>
            </div>

            <div style={{ ...CONTENT_STYLE, ...contentTransition }}>
                <div style={LABEL_STYLE}>{displayTitle}</div>
                <p>{displayBody}</p>
            </div>

            <div style={
                contentVisible
                    ? { transition: 'opacity 300ms ease-out 150ms' }
                    : { opacity: 0, transition: 'opacity 300ms ease-out 150ms' }
            }>
                <ChatInput onSend={sendMessage} placeholder={t('nodePopup.inputPlaceholder')} />
            </div>
        </div>
    );
};
