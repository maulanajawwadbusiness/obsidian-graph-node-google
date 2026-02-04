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

import { getTopology, addKnowledgeLink, removeKnowledgeLink, patchTopology, clearTopology, getTopologyVersion } from './topologyControl';
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
        const id = addKnowledgeLink({
            from: fromId,
            to: toId,
            kind: kind || 'manual',
            weight: 1.0
        }, DEFAULT_PHYSICS_CONFIG);
        console.log(`[DevTopology] addLink: ${fromId} -> ${toId} (kind: ${kind || 'manual'}, id: ${id})`);
        return id;
    },

    /**
     * Remove a directed link.
     */
    removeLink(idOrFrom: string, toId?: string) {
        if (toId) {
            console.warn(`[DevTopology] removeLink: endpoint removal is ambiguous; use directedLinkId when possible`);
            const match = getTopology().links.find(l => l.from === idOrFrom && l.to === toId);
            if (!match || !match.id) {
                console.warn(`[DevTopology] removeLink: no match for ${idOrFrom} -> ${toId}`);
                return false;
            }
            return removeKnowledgeLink(match.id, DEFAULT_PHYSICS_CONFIG);
        }

        return removeKnowledgeLink(idOrFrom, DEFAULT_PHYSICS_CONFIG);
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
     * Clear the topology.
     */
    clear() {
        clearTopology();
    },

    /**
     * STEP6-RUN6: Mutation history API
     */
    mutations: {
        async history(limit?: number) {
            if (!import.meta.env.DEV) return [];
            const mod = await import('./topologyMutationObserver');
            return mod.getMutationHistory(limit);
        },

        async last(verbose?: boolean) {
            if (!import.meta.env.DEV) return null;
            const mod = await import('./topologyMutationObserver');
            return mod.getLastMutation(verbose);
        },

        async clear() {
            if (!import.meta.env.DEV) return;
            const mod = await import('./topologyMutationObserver');
            mod.clearMutationHistory();
        },

        async on(callback: (event: any) => void) {
            if (!import.meta.env.DEV) return () => { };
            const mod = await import('./topologyMutationObserver');
            return mod.subscribeMutationObserver(callback);
        },

        async table(limit: number = 10) {
            if (!import.meta.env.DEV) return;
            const mod = await import('./topologyMutationObserver');
            const events = mod.getMutationHistory(limit);
            if (events.length === 0) {
                console.log('[DevTopology] No mutations yet');
                return;
            }
            const rows = events.map(e => ({
                ID: e.mutationId,
                Status: e.status,
                Source: e.source,
                'V->': `${e.versionBefore}->${e.versionAfter}`,
                dN: e.countsAfter.nodes - e.countsBefore.nodes,
                dL: e.countsAfter.directedLinks - e.countsBefore.directedLinks,
                dS: e.countsAfter.springs - e.countsBefore.springs
            }));
            console.table(rows);
        }
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
