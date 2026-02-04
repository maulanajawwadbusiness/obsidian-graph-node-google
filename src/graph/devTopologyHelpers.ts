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
            // STEP7-RUN12: Include provider and hash columns
            const rows = events.map(e => ({
                ID: e.mutationId,
                Status: e.status,
                Source: e.source,
                Provider: e.providerName || '-',
                Hash: e.inputHash?.slice(0, 8) || '-',
                'V->': `${e.versionBefore}->${e.versionAfter}`,
                dN: e.countsAfter.nodes - e.countsBefore.nodes,
                dL: e.countsAfter.directedLinks - e.countsBefore.directedLinks,
                dS: e.countsAfter.springs - e.countsBefore.springs
            }));
            console.table(rows);
        }
    },

    /**
     * STEP 8 - RUN 10: Dump physics mapping policy state.
     * Shows edge type mappings and current spring stats.
     */
    physicsPolicyDump() {
        if (!import.meta.env.DEV) return;

        import('./physicsMappingPolicy').then(mod => {
            const { DEFAULT_EDGE_TYPE_POLICY, PARAM_CLAMP } = mod;

            console.group('[PhysicsMappingPolicy] Policy Configuration');

            // Dump edge type mappings
            console.log('Edge Type Mappings:');
            const mappings = Object.entries(DEFAULT_EDGE_TYPE_POLICY)
                .filter(([key]) => key !== '*')
                .map(([type, params]) => ({
                    Type: type,
                    Compliance: params.compliance ?? '(global)',
                    RestPolicy: params.restLengthPolicy || 'inherit',
                    RestScale: params.restLengthScale ?? '-',
                    DampingScale: params.dampingScale ?? 1.0
                }));
            console.table(mappings);

            // Dump clamp ranges
            console.log('Parameter Clamp Ranges:');
            const clamps = [
                { Param: 'compliance', Min: PARAM_CLAMP.compliance.min, Max: PARAM_CLAMP.compliance.max },
                { Param: 'dampingScale', Min: PARAM_CLAMP.dampingScale.min, Max: PARAM_CLAMP.dampingScale.max },
                { Param: 'restLength', Min: PARAM_CLAMP.restLength.min, Max: PARAM_CLAMP.restLength.max },
                { Param: 'restLengthScale', Min: PARAM_CLAMP.restLengthScale.min, Max: PARAM_CLAMP.restLengthScale.max }
            ];
            console.table(clamps);

            // Dump current spring stats
            const topology = getTopology();
            if (topology.springs && topology.springs.length > 0) {
                console.log(`Current Springs: ${topology.springs.length}`);

                const edgeTypeCounts = new Map<string, number>();
                const stiffnessValues: number[] = [];
                const restLenValues: number[] = [];

                for (const spring of topology.springs) {
                    const edgeType = (spring.meta as any)?.edgeType || 'unknown';
                    edgeTypeCounts.set(edgeType, (edgeTypeCounts.get(edgeType) || 0) + 1);
                    stiffnessValues.push(spring.stiffness);
                    restLenValues.push(spring.restLen);
                }

                console.log('Edge Type Counts:');
                const typeRows = Array.from(edgeTypeCounts.entries()).map(([type, count]) => ({ Type: type, Count: count }));
                console.table(typeRows);

                if (stiffnessValues.length > 0) {
                    const minS = Math.min(...stiffnessValues);
                    const maxS = Math.max(...stiffnessValues);
                    const avgS = stiffnessValues.reduce((a, b) => a + b, 0) / stiffnessValues.length;
                    console.log(`Stiffness: min=${minS.toFixed(2)}, max=${maxS.toFixed(2)}, avg=${avgS.toFixed(2)}`);
                }

                if (restLenValues.length > 0) {
                    const minR = Math.min(...restLenValues);
                    const maxR = Math.max(...restLenValues);
                    const avgR = restLenValues.reduce((a, b) => a + b, 0) / restLenValues.length;
                    console.log(`Rest Length: min=${minR.toFixed(1)}px, max=${maxR.toFixed(1)}px, avg=${avgR.toFixed(1)}px`);
                }
            } else {
                console.log('Current Springs: (none)');
            }

            console.groupEnd();
        });
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
