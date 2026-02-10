import { useEffect, useState } from 'react';
import type { AnchorGeometry } from './popupTypes';

/**
 * useAnchorGeometry Hook
 * 
 * Provides real-time screen geometry for a node.
 * Returns null if nodeId is null or node doesn't exist.
 * 
 * Future: This will subscribe to camera/node updates for live tracking.
 * Current: Returns static geometry snapshot from initial popup open.
 */

interface UseAnchorGeometryOptions {
    /** Enable live tracking (re-compute on camera/node movement) */
    liveTracking?: boolean;

    /** Update interval for live tracking (ms) */
    updateInterval?: number;
}

export function useAnchorGeometry(
    nodeId: string | null,
    staticGeometry: AnchorGeometry | null,
    options: UseAnchorGeometryOptions = {}
): AnchorGeometry | null {
    const { liveTracking = false } = options; // updateInterval removed for now
    const [geometry, setGeometry] = useState<AnchorGeometry | null>(staticGeometry);

    useEffect(() => {
        // If no nodeId, clear geometry
        if (!nodeId) {
            setGeometry(null);
            return;
        }

        // Use static geometry for now
        setGeometry(staticGeometry);

        // TODO: Implement live tracking when needed
        // This would:
        // 1. Get engineRef and cameraRef from context
        // 2. Compute worldToScreen on interval
        // 3. Update geometry state
        // 4. Clean up on unmount

        if (liveTracking) {
            console.warn('[useAnchorGeometry] Live tracking not yet implemented');
        }

    }, [nodeId, staticGeometry, liveTracking]);

    return geometry;
}

/**
 * Geometry Provider Stub
 * 
 * Future implementation will integrate with:
 * - Physics engine for node positions
 * - Camera state for world->screen transform
 * - Hover state for radius calculations
 * 
 * For now, consumers use staticGeometry passed from popup state.
 */
export function createGeometryProvider() {
    console.log('[GeometryProvider] Stub - not yet implemented');

    return {
        getNodeGeometry: (nodeId: string) => {
            console.warn(`[GeometryProvider] getNodeGeometry(${nodeId}) - stub`);
            return null;
        },
        subscribe: (_callback: () => void) => {
            console.warn('[GeometryProvider] subscribe - stub');
            return () => { }; // Unsubscribe function
        },
    };
}
