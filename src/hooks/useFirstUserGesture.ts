import React from 'react';

type FirstGestureEvent = PointerEvent | KeyboardEvent;

type UseFirstUserGestureOptions = {
    enabled?: boolean;
    preventDefaultKeys?: string[];
};

export function useFirstUserGesture(
    onFirstGesture: (event: FirstGestureEvent) => void | Promise<void>,
    options: UseFirstUserGestureOptions = {}
): void {
    const enabled = options.enabled ?? true;
    const preventDefaultKeys = options.preventDefaultKeys ?? [];
    const onFirstGestureRef = React.useRef(onFirstGesture);

    React.useEffect(() => {
        onFirstGestureRef.current = onFirstGesture;
    }, [onFirstGesture]);

    React.useEffect(() => {
        if (!enabled) return;
        if (typeof window === 'undefined') return;

        let consumed = false;
        const preventSet = new Set(preventDefaultKeys);

        const consume = (event: FirstGestureEvent) => {
            if (consumed) return;
            consumed = true;
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown, true);
            void onFirstGestureRef.current(event);
        };

        const onPointerDown = (event: PointerEvent) => {
            consume(event);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (preventSet.has(event.key) || preventSet.has(event.code)) {
                event.preventDefault();
            }
            consume(event);
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('keydown', onKeyDown, true);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [enabled, preventDefaultKeys]);
}
