import { useCallback } from 'react';
import type { MouseEvent, MutableRefObject, RefObject } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { getRenderNodeRadius, GraphTheme } from './graphThemes';

type SettingsRef = {
    useVariedSize: boolean;
};

type InteractionParams = {
    canvasRef: RefObject<HTMLCanvasElement>;
    engineRef: MutableRefObject<PhysicsEngine>;
    themeRef: MutableRefObject<GraphTheme>;
    settingsRef: MutableRefObject<SettingsRef>;
};

export const useGraphInteractions = ({
    canvasRef,
    engineRef,
    themeRef,
    settingsRef
}: InteractionParams) => {
    const getWorldPos = useCallback((e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        // Transform screen coords to world coords (considering 0,0 center)
        const px = e.clientX - rect.left - canvas.width / 2;
        const py = e.clientY - rect.top - canvas.height / 2;
        return { x: px, y: py };
    }, [canvasRef]);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        const { x, y } = getWorldPos(e);

        // Find node under cursor
        // Simple naive search (checking all nodes). Fine for <1000 nodes.
        let hitId: string | null = null;
        let minDist = Infinity;
        const theme = themeRef.current;

        engineRef.current.nodes.forEach((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            const d = Math.sqrt(dx * dx + dy * dy);
            // Give a bit of fuzzy hit area (radius + 5px padding)
            const hitRadius = getRenderNodeRadius(node, theme, settingsRef.current.useVariedSize) + 10;
            if (d < hitRadius && d < minDist) {
                minDist = d;
                hitId = node.id;
            }
        });

        if (hitId) {
            engineRef.current.grabNode(hitId, { x, y });
        }
    }, [engineRef, getWorldPos, settingsRef, themeRef]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const { x, y } = getWorldPos(e);
        engineRef.current.moveDrag({ x, y });
    }, [engineRef, getWorldPos]);

    const handleMouseUp = useCallback(() => {
        engineRef.current.releaseNode();
    }, [engineRef]);

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp
    };
};
