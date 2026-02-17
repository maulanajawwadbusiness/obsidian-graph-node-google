import React from 'react';
import {
    GRAPH_LOADING_SCREEN_FADE_EASING,
    GRAPH_LOADING_SCREEN_FADE_MS,
} from '../transitions/transitionTokens';

export type ContentFadePhase = 'idle' | 'fadingOut' | 'fadingIn';

type ContentFadeOverlayProps = {
    phase: ContentFadePhase;
    fadeMs?: number;
    fadeEasing?: string;
    onFadeOutDone?: () => void;
    onFadeInDone?: () => void;
};

const ROOT_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#06060A',
    zIndex: 40,
};

const FALLBACK_FADE_MS = 200;
const FALLBACK_FADE_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

export const ContentFadeOverlay: React.FC<ContentFadeOverlayProps> = ({
    phase,
    fadeMs = GRAPH_LOADING_SCREEN_FADE_MS ?? FALLBACK_FADE_MS,
    fadeEasing = GRAPH_LOADING_SCREEN_FADE_EASING ?? FALLBACK_FADE_EASING,
    onFadeOutDone,
    onFadeInDone,
}) => {
    const active = phase !== 'idle';
    const lastHandledPhaseRef = React.useRef<ContentFadePhase>('idle');

    React.useEffect(() => {
        if (phase !== lastHandledPhaseRef.current) {
            lastHandledPhaseRef.current = 'idle';
        }
    }, [phase]);

    const stopPointer: React.PointerEventHandler<HTMLDivElement> = React.useCallback((event) => {
        if (!active) return;
        event.preventDefault();
        event.stopPropagation();
    }, [active]);

    const stopWheel: React.WheelEventHandler<HTMLDivElement> = React.useCallback((event) => {
        if (!active) return;
        event.preventDefault();
        event.stopPropagation();
    }, [active]);

    const onTransitionEnd = React.useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
        if (!active) return;
        if (event.propertyName !== 'opacity') return;
        if (event.target !== event.currentTarget) return;
        if (lastHandledPhaseRef.current === phase) return;
        lastHandledPhaseRef.current = phase;
        if (phase === 'fadingOut') {
            onFadeOutDone?.();
            return;
        }
        if (phase === 'fadingIn') {
            onFadeInDone?.();
        }
    }, [active, onFadeInDone, onFadeOutDone, phase]);

    const style: React.CSSProperties = {
        ...ROOT_STYLE,
        opacity: phase === 'fadingOut' ? 1 : 0,
        transition: `opacity ${fadeMs}ms ${fadeEasing}`,
        pointerEvents: active ? 'auto' : 'none',
    };

    return (
        <div
            aria-hidden="true"
            data-content-fade-phase={phase}
            style={style}
            onTransitionEnd={onTransitionEnd}
            onPointerDownCapture={stopPointer}
            onPointerMoveCapture={stopPointer}
            onPointerUpCapture={stopPointer}
            onWheelCapture={stopWheel}
        />
    );
};
