import React, { useEffect, useRef, useState } from 'react';
import { usePopup } from './PopupStore';
import { ChatInput } from './ChatInput';
import { ChatShortageNotif } from './ChatShortageNotif';
import { t } from '../i18n/t';
import { useTooltip } from '../ui/tooltip/useTooltip';
import { usePortalScopeMode } from '../components/portalScope/PortalScopeContext';

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

const GAP_FROM_NODE = 20;

// BACKDROP - Handles click-outside-to-close without document-level listener
const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1000,  // Below popup (1001) but above UI buttons (10-11)
    pointerEvents: 'auto',
    background: 'transparent',  // Invisible but clickable
};

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
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
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
    fontWeight: 300,
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
};

const CONTENT_STYLE: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    fontSize: '14px',
    fontWeight: 300,
    lineHeight: '1.6',
};

const BACKDROP_STYLE_CONTAINER: React.CSSProperties = {
    ...BACKDROP_STYLE,
    position: 'absolute',
};

const LABEL_STYLE: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '300',
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
}

import { PhysicsEngine } from '../physics/engine';
import { RenderTickDetail } from '../playground/rendering/renderingTypes';
import { quantizeToDevicePixel } from '../playground/rendering/renderingMath';

interface NodePopupProps {
    trackNode?: (nodeId: string) => { x: number; y: number; radius: number } | null;
    engineRef?: React.RefObject<PhysicsEngine>;
}

export const NodePopup: React.FC<NodePopupProps> = ({ trackNode, engineRef }) => {
    const portalMode = usePortalScopeMode();
    const { selectedNodeId, anchorGeometry, closePopup, sendMessage, setPopupRect, content } = usePopup();
    const popupRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);
    const closeTooltip = useTooltip(t('tooltip.close'));

    // Staged reveal
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

    // Initial position from store (for first paint before sync)
    // We keep this to prevent "jump" on mount if tick hasn't happened.
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

    // FIX: Removed document-level mousedown listener
    // Click-outside is now handled by backdrop element (see render)

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

    // FIX 26: Synchronous Overlay Positioning & FIX 25: Consistent Rounding
    useEffect(() => {
        if (!selectedNodeId || !isVisible) return;

        const handleSync = (e: Event) => {
            if (!popupRef.current) return;

            // Prefer Event Detail (Exact Camera Snapshot)
            const detail = (e as CustomEvent<RenderTickDetail>).detail;
            let finalLeft = 0;
            let finalTop = 0;
            let finalOx = 0;
            let finalOy = 0;
            let hasPosition = false;

            if (detail && engineRef?.current) {
                const node = engineRef.current.nodes.get(selectedNodeId);
                if (node) {
                    const { x, y } = detail.transform.worldToScreen(node.x, node.y);
                    // Use approximate radius scaling same as playground
                    // Note: We use zoom from the transform if available, or assume it's baked in?
                    // renderingMath.ts rotateAround/etc don't expose zoom directly unless we cast or it's public.
                    // CameraTransform in camera.ts HAS a public zoom property? 
                    // Let's check Step 31. public zoom is NOT exposed on the instance? 
                    // It has `private zoom: number`. But `applyToContext` uses it.
                    // `worldToScreen` uses it.
                    // We can't access `transform.zoom` if it's private.
                    // However, we can approximate scale by transforming a vector? 
                    // OR we just rely on `node.radius * 5` rule if that's what user wants?
                    // User constraint: "overlay stays glued".
                    // If we use fixed pixel radius (e.g. 20px), and we zoom in, the node gets huge, the popup stays inside?
                    // Logic in GraphPhysicsPlayground used `screenRadius = node.radius * 5`.
                    // But wait, `worldToScreen` returns coordinates.
                    // If we want the popup to be relative to the visual node edge, we need visual radius.
                    // Visual radius = node.radius * zoom.
                    // We can cheat: transform (x+r, y) and measure distance to (x,y)?
                    const center = detail.transform.worldToScreen(node.x, node.y);
                    const edge = detail.transform.worldToScreen(node.x + node.radius, node.y);
                    const dx = edge.x - center.x;
                    const dy = edge.y - center.y;
                    const screenRadius = Math.sqrt(dx * dx + dy * dy);

                    const geom = { x, y, radius: screenRadius };
                    const width = popupRef.current.offsetWidth;
                    const height = popupRef.current.offsetHeight;

                    // Pure layout calculation
                    const rawPos = computePopupPosition(geom, width, height);

                    // FIX 25 & 26: Consistent Rounding & Shared Snapshot
                    // We adhere to the "Sacred 60" policy:
                    // - Motion = Float (Smooth)
                    // - Rest = Snapped (Crisp)
                    const dpr = detail.dpr || window.devicePixelRatio || 1;
                    const snapEnabled = detail.snapEnabled ?? true; // Default to true if missing (safe)

                    // Helper: Quantize if snapped, else raw float
                    const processCoord = (val: number) => {
                        if (snapEnabled) {
                            return quantizeToDevicePixel(val, dpr);
                        }
                        return val; // Float for smooth motion
                    };

                    finalLeft = processCoord(rawPos.left);
                    finalTop = processCoord(rawPos.top);
                    finalOx = processCoord(rawPos.originX);
                    finalOy = processCoord(rawPos.originY);
                    hasPosition = true;
                }
            } else if (trackNode) {
                // Fallback for legacy / side-loading (e.g. initial mount before first tick)
                // We default to "Snapping" behavior here for stability, unless we know better.
                const geom = trackNode(selectedNodeId);
                if (geom) {
                    const width = popupRef.current.offsetWidth;
                    const height = popupRef.current.offsetHeight;
                    const rawPos = computePopupPosition(geom, width, height);
                    const dpr = window.devicePixelRatio || 1;
                    // Default to quantized for legacy path
                    finalLeft = quantizeToDevicePixel(rawPos.left, dpr);
                    finalTop = quantizeToDevicePixel(rawPos.top, dpr);
                    finalOx = quantizeToDevicePixel(rawPos.originX, dpr);
                    finalOy = quantizeToDevicePixel(rawPos.originY, dpr);
                    hasPosition = true;
                }
            }

            if (hasPosition) {
                popupRef.current.style.left = `${finalLeft}px`;
                popupRef.current.style.top = `${finalTop}px`;
                popupRef.current.style.transformOrigin = `${finalOx}px ${finalOy}px`;
            }
        };

        // Listen for the Master Tick
        window.addEventListener('graph-render-tick', handleSync);

        return () => window.removeEventListener('graph-render-tick', handleSync);
    }, [selectedNodeId, trackNode, isVisible, engineRef]);

    const finalStyle: React.CSSProperties = {
        ...POPUP_STYLE,
        ...(isVisible ? POPUP_VISIBLE_STYLE : {}),
        left: `${position.left}px`,
        top: `${position.top}px`,
        transformOrigin: `${position.originX}px ${position.originY}px`,
    };

    return (
        <>
            {/* Backdrop - handles click-outside without document listener */}
            <div
                style={portalMode === 'container' ? BACKDROP_STYLE_CONTAINER : BACKDROP_STYLE}
                onClick={closePopup}
                onMouseDown={stopPropagation}
                onPointerDown={stopPropagation}
            />
            <div
                id="arnvoid-node-popup"
                ref={popupRef}
                data-font="ui"
                style={finalStyle}
                onMouseDown={stopPropagation}
                onMouseMove={stopPropagation}
                onMouseUp={stopPropagation}
                onPointerDown={stopPropagation}
                onPointerMove={stopPropagation}
                onPointerUp={stopPropagation}
                onClick={stopPropagation}
                onWheel={stopPropagation}
            >
                <div style={{ ...HEADER_STYLE, ...contentTransition }}>
                    <span style={{ fontSize: '14px', opacity: 0.7 }}>{t('nodePopup.header')}</span>
                    <button
                        {...closeTooltip.getAnchorProps({
                            style: CLOSE_BUTTON_STYLE,
                            onClick: closePopup,
                            onPointerDown: stopPropagation,
                            onMouseEnter: (e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'; },
                            onMouseLeave: (e) => { e.currentTarget.style.color = 'rgba(180, 190, 210, 0.7)'; },
                        })}
                    >
                        x
                    </button>
                </div>

                <div style={{ ...CONTENT_STYLE, ...contentTransition }}>
                    <div style={LABEL_STYLE} data-font="title">{displayTitle}</div>
                    <p>{displayBody}</p>
                </div>

                <div style={
                    contentVisible
                        ? { transition: 'opacity 300ms ease-out 150ms' }
                        : { opacity: 0, transition: 'opacity 300ms ease-out 150ms' }
                }>
                    <ChatInput onSend={(text) => sendMessage(text, 'node-popup')} placeholder={t('nodePopup.inputPlaceholder')} />
                </div>
            </div>
            <ChatShortageNotif surface="node-popup" anchorRef={popupRef} zIndex={1003} />
        </>
    );
};
