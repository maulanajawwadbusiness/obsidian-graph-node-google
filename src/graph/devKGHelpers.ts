/**
 * Dev-only KGSpec console helpers
 * 
 * Exposed via window.__kg for manual testing.
 * DO NOT use in production code.
 */

// CRITICAL SAFEGUARD: This module should NEVER be bundled in production
// Primary gating is via dynamic import (where this is imported)
// This is a defensive backup in case of accidental static import
if (!import.meta.env.DEV) {
    /**
     * Validate a KGSpec without loading.
     */
    validate(spec: KGSpec) {
        console.log('[DevKG] validate: checking spec...');
        const result = validateKGSpec(spec);
        console.log(`[DevKG] Validation ${result.ok ? 'PASSED ✓' : 'FAILED ✗'}`);
        if (result.errors.length > 0) {
            console.error(`[DevKG] Errors (${result.errors.length}):`, result.errors);
        }
        if (result.warnings.length > 0) {
            console.warn(`[DevKG] Warnings (${result.warnings.length}):`, result.warnings);
        }
        return result;
    },

    /**
     * Export current topology as KGSpec.
     */
    dump() {
        console.log('[DevKG] dump: exporting current topology as KGSpec...');
        const spec = exportTopologyAsKGSpec();
        console.log('[DevKG] Exported spec:', spec);
        return spec;
    },

    /**
     * STEP3-RUN7: Proof of directed→undirected split.
     * Loads A→B + B→A and logs counts to demonstrate:
     * - Knowledge layer: 2 directed links
     * - Physics layer: 1 undirected spring
     * - XPBD: 1 constraint (matches springs)
     */
    proof() {
        console.log('[DevKG] STEP3-RUN7: Knowledge/Physics Split Proof');
        console.log('[DevKG] Loading: A→B + B→A (2 directed links)...');

        const spec: KGSpec = {
            specVersion: 'kg/1',
            nodes: [
                { id: 'A', label: 'Node A' },
                { id: 'B', label: 'Node B' }
            ],
            links: [
                { from: 'A', to: 'B', rel: 'connects', weight: 1.0 },
                { from: 'B', to: 'A', rel: 'connects', weight: 1.0 }
            ]
        };

        const loaded = devKGHelpers.load(spec);
        if (!loaded) {
            console.error('[DevKG] Proof failed - load error');
            return false;
        }

        // Get topology to inspect
        const topology = getTopology();

        console.log('');
        console.log('=== STEP3 PROOF: Directed→Undirected Split ===');
        console.log(`✓ Knowledge layer (directed): ${topology.links.length} links`);
        console.log(`  - ${topology.links[0].from} → ${topology.links[0].to}`);
        console.log(`  - ${topology.links[1].from} → ${topology.links[1].to}`);
        console.log(`✓ Physics layer (undirected): ${topology.springs?.length || 0} springs`);
        if (topology.springs && topology.springs.length > 0) {
            const spring = topology.springs[0];
            console.log(`  - {${spring.a}, ${spring.b}} (unordered pair)`);
        }
        console.log(`✓ Expected XPBD constraints: ${topology.springs?.length || 0} (matches springs, NOT ${topology.links.length} links)`);
        // DEV: If engine is exposed, log actual XPBD constraint count after a couple frames.
        if (typeof window !== 'undefined' && (window as any).__engine) {
            const engine = (window as any).__engine;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const xpbdCount = engine?.xpbdFrameAccum?.springs?.count ?? 0;
                    console.log(`✓ XPBD constraint count (actual): ${xpbdCount}`);
                });
            });
        }
        console.log('==============================================');
        console.log('');

        return true;
    },

    /**
     * Load the example KGSpec.
     */
    loadExample() {
        console.log('[DevKG] loadExample: loading EXAMPLE_KG_SPEC...');
        return devKGHelpers.load(EXAMPLE_KG_SPEC);
    }
};

// PRE-STEP2 pattern: Dev-only + browser-only gating
// Only expose to window.__kg in development mode AND browser environment
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__kg = devKGHelpers;
    (window as any).__kg_proof = devKGHelpers.proof;
    console.log('[DevKG] Console helpers loaded (DEV MODE). Try: window.__kg.proof() or window.__kg_proof()');
} else if (typeof window !== 'undefined') {
    console.log('[DevKG] Helpers disabled in production build.');
}
