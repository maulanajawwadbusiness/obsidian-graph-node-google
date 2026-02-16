import React from 'react';

export type GraphViewportMode = 'app' | 'boxed';
export type GraphViewportSource = 'window' | 'container' | 'unknown';

export type GraphViewportRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type GraphViewport = {
    mode: GraphViewportMode;
    source: GraphViewportSource;
    width: number;
    height: number;
    dpr: number;
    boundsRect: GraphViewportRect | null;
};

export function defaultGraphViewport(): GraphViewport {
    if (typeof window === 'undefined') {
        return {
            mode: 'app',
            source: 'unknown',
            width: 0,
            height: 0,
            dpr: 1,
            boundsRect: null,
        };
    }
    const width = Math.max(0, window.innerWidth || 0);
    const height = Math.max(0, window.innerHeight || 0);
    const dpr = Math.max(0.1, window.devicePixelRatio || 1);
    return {
        mode: 'app',
        source: 'window',
        width,
        height,
        dpr,
        boundsRect: {
            left: 0,
            top: 0,
            width,
            height,
        },
    };
}

const GRAPH_VIEWPORT_FALLBACK: GraphViewport = Object.freeze(defaultGraphViewport());

const GraphViewportContext = React.createContext<GraphViewport>(GRAPH_VIEWPORT_FALLBACK);

type GraphViewportProviderProps = {
    value: GraphViewport;
    children: React.ReactNode;
};

export const GraphViewportProvider: React.FC<GraphViewportProviderProps> = ({ value, children }) => {
    const stableValue = React.useMemo<GraphViewport>(() => {
        return {
            mode: value.mode,
            source: value.source,
            width: value.width,
            height: value.height,
            dpr: value.dpr,
            boundsRect: value.boundsRect
                ? {
                    left: value.boundsRect.left,
                    top: value.boundsRect.top,
                    width: value.boundsRect.width,
                    height: value.boundsRect.height,
                }
                : null,
        };
    }, [
        value.mode,
        value.source,
        value.width,
        value.height,
        value.dpr,
        value.boundsRect?.left,
        value.boundsRect?.top,
        value.boundsRect?.width,
        value.boundsRect?.height,
    ]);

    return (
        <GraphViewportContext.Provider value={stableValue}>
            {children}
        </GraphViewportContext.Provider>
    );
};

export function useGraphViewport(): GraphViewport {
    return React.useContext(GraphViewportContext);
}

export function getGraphViewportDebugSnapshot(viewport: GraphViewport): GraphViewport {
    return {
        mode: viewport.mode,
        source: viewport.source,
        width: viewport.width,
        height: viewport.height,
        dpr: viewport.dpr,
        boundsRect: viewport.boundsRect
            ? {
                left: viewport.boundsRect.left,
                top: viewport.boundsRect.top,
                width: viewport.boundsRect.width,
                height: viewport.boundsRect.height,
            }
            : null,
    };
}
