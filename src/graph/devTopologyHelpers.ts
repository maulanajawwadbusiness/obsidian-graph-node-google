/**
 * Dev-only topology console helpers
 * 
 * Exposed via window.__topology for manual testing.
 * DO NOT use in production code.
 */

// CRITICAL SAFEGUARD: This module should NEVER be bundled in production
// Primary gating is via dynamic import in GraphPhysicsPlayground.tsx
// This is a defensive backup in case of accidental static import
if (!import.meta.env.DEV) {
    throw new Error('[SECURITY] devTopologyHelpers loaded in production build - CHECK IMPORTS');
}

import { getTopology, patchTopology, clearTopology, getTopologyVersion } from './topologyControl';
import type { DirectedLink } from './topologyTypes';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';

/**
 * Minimal dev helpers for console testing.
 */
export const devTopologyHelpers = {
    /**
     * Add a single directed link.
     */
    addLink(fromId: string, toId: string, kind?: string) {
        console.log(`[DevTopology] addLink: ${fromId} → ${toId} (kind: ${kind || 'manual'})`);
        // STEP3-RUN5-V5-FIX2: Pass default config for rest-length policy
        patchTopology({
            addLinks: [{
                from: fromId,
                to: toId,
                kind: kind || 'manual',
                weight: 1.0
            }]
        }, DEFAULT_PHYSICS_CONFIG);
    },

    /**
     * Remove a directed link.
     */
    removeLink(fromId: string, toId: string) {
        console.log(`[DevTopology] removeLink: ${fromId} → ${toId}`);
        // STEP3-RUN5-V5-FIX2: Pass default config for rest-length policy
        patchTopology({
            removeLinks: [{ from: fromId, to: toId }]
        }, DEFAULT_PHYSICS_CONFIG);
    },

    /**
     * Replace all links (keeps nodes).
     */
    setLinks(links: DirectedLink[]) {
        console.log(`[DevTopology] setLinks: replacing with ${links.length} links`);
        // STEP3-RUN5-V5-FIX2: Pass default config for rest-length policy
        patchTopology({
            setLinks: links
        }, DEFAULT_PHYSICS_CONFIG);
    },

    /**
     * Dump current topology to console.
     */
    dump() {
        const t = getTopology();
        console.log(`[DevTopology] Topology v${getTopologyVersion()}:`, {
            nodes: t.nodes.length,
            links: t.links.length,
            nodesSample: t.nodes.slice(0, 5),
            linksSample: t.links.slice(0, 10)
        });
        return t;
    },

    /**
     * Get current version number.
     */
    version() {
        return getTopologyVersion();
    },

    /**
     * Clear all topology.
     */
    clear() {
        console.log('[DevTopology] Clearing all topology');
        clearTopology();
    }
};

// PRE-STEP2: Dev-only + browser-only gating
// Only expose to window.__topology in development mode AND browser environment
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__topology = devTopologyHelpers;
    console.log('[DevTopology] Console helpers loaded (DEV MODE). Try: window.__topology.dump()');
} else if (typeof window !== 'undefined') {
    console.log('[DevTopology] Helpers disabled in production build.');
}
