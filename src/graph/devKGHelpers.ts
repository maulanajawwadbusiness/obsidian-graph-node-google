/**
 * Dev-only KGSpec console helpers
 * 
 * Exposed via window.__kg for manual testing.
 * DO NOT use in production code.
 */

// CRITICAL SAFEGUARD: This module should NEVER be bundled in production
// Primary gating is via dynamic import in GraphPhysicsPlayground.tsx
// This is a defensive backup in case of accidental static import
if (!import.meta.env.DEV) {
    throw new Error('[SECURITY] devKGHelpers loaded in production build - CHECK IMPORTS');
}

import type { KGSpec } from './kgSpec';
import { EXAMPLE_KG_SPEC } from './kgSpec';
import { validateKGSpec } from './kgSpecValidation';
import type { IngestOptions } from './kgSpecLoader';
import { setTopologyFromKGSpec, exportTopologyAsKGSpec } from './kgSpecLoader';
import { getTopology } from './topologyControl';

/**
 * Minimal dev helpers for KGSpec console testing.
 */
export const devKGHelpers = {
    /**
     * Validate a KGSpec without loading.
     */
    validate(spec: KGSpec) {
        console.log('[DevKG] validate: checking spec...');
        const result = validateKGSpec(spec);
        console.log(`[DevKG] Validation ${result.ok ? 'PASSED' : 'FAILED'}`);
        if (result.errors.length > 0) {
            console.error(`[DevKG] Errors (${result.errors.length}):`, result.errors);
        }
        if (result.warnings.length > 0) {
            console.warn(`[DevKG] Warnings (${result.warnings.length}):`, result.warnings);
        }
        return result;
    },

    /**
     * Load a KGSpec into topology.
     */
    load(spec: KGSpec, opts?: IngestOptions) {
        console.log('[DevKG] load: attempting load...');
        const success = setTopologyFromKGSpec(spec, opts);
        console.log(`[DevKG] load: ${success ? 'SUCCESS' : 'FAILED'}`);
        return success;
    },

    /**
     * STEP5-RUN9: Try to load a KGSpec and return detailed results.
     */
    tryLoad(spec: KGSpec, opts?: IngestOptions) {
        console.log('[DevKG] tryLoad: attempting load...');
        const shouldValidate = opts?.validate !== false;
        const validation = shouldValidate ? validateKGSpec(spec) : {
            ok: true,
            errors: [],
            warnings: []
        };
        const success = setTopologyFromKGSpec(spec, opts);

        const result = {
            success,
            validation,
            message: success
                ? 'Load successful'
                : validation.ok
                    ? 'Load failed (unknown reason)'
                    : 'Load failed (validation errors)'
        };

        console.log(`[DevKG] ${result.message}`);
        return result;
    },

    /**
     * STEP5-RUN9: Run contract test suite.
     */
    contractTests() {
        console.log('=== STEP5 RUN9: Contract Tests ===');

        const tests = [
            {
                name: 'Valid spec',
                spec: {
                    specVersion: 'kg/1' as const,
                    nodes: [{ id: 'A' }, { id: 'B' }],
                    links: [{ from: 'A', to: 'B', rel: 'causes', weight: 0.8 }]
                },
                expectOk: true
            },
            {
                name: 'Self-loop',
                spec: {
                    specVersion: 'kg/1' as const,
                    nodes: [{ id: 'A' }],
                    links: [{ from: 'A', to: 'A', rel: 'self' }]
                },
                expectOk: false
            },
            {
                name: 'Missing endpoint',
                spec: {
                    specVersion: 'kg/1' as const,
                    nodes: [{ id: 'A' }],
                    links: [{ from: 'A', to: 'B', rel: 'missing' }]
                },
                expectOk: false
            },
            {
                name: 'Duplicate dot ID',
                spec: {
                    specVersion: 'kg/1' as const,
                    nodes: [{ id: 'A' }, { id: 'A' }],
                    links: []
                },
                expectOk: false
            },
            {
                name: 'NaN weight',
                spec: {
                    specVersion: 'kg/1' as const,
                    nodes: [{ id: 'A' }, { id: 'B' }],
                    links: [{ from: 'A', to: 'B', rel: 'test', weight: NaN }]
                },
                expectOk: false
            },
            {
                name: 'Unknown rel (warning only)',
                spec: {
                    specVersion: 'kg/1' as const,
                    nodes: [{ id: 'A' }, { id: 'B' }],
                    links: [{ from: 'A', to: 'B', rel: 'weird_custom_rel', weight: 1.0 }]
                },
                expectOk: true
            }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            const result = validateKGSpec(test.spec);
            const actualOk = result.ok;
            const testPassed = actualOk === test.expectOk;

            if (testPassed) {
                console.log(`[PASS] ${test.name}: ${actualOk ? 'PASS' : 'FAIL (expected)'}`);
                passed++;
            } else {
                console.error(`[FAIL] ${test.name}: expected ${test.expectOk ? 'PASS' : 'FAIL'}, got ${actualOk ? 'PASS' : 'FAIL'}`);
                failed++;
            }

            if (result.errors.length > 0 && import.meta.env.DEV) {
                console.log(`  Errors: ${result.errors.slice(0, 2).join('; ')}`);
            }
            if (result.warnings.length > 0 && import.meta.env.DEV) {
                console.log(`  Warnings: ${result.warnings.slice(0, 2).join('; ')}`);
            }
        }

        console.log(`=== Results: ${passed}/${tests.length} passed, ${failed} failed ===`);
        return { passed, failed, total: tests.length };
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
     * STEP3-RUN7: Proof of directed->undirected split.
     * Loads A->B + B->A and logs counts to demonstrate:
     * - Knowledge layer: 2 directed links
     * - Physics layer: 1 undirected spring
     */
    proof() {
        console.log('[DevKG] proof: Loading A->B + B->A to demonstrate directed->undirected split...');

        const proofSpec: KGSpec = {
            specVersion: 'kg/1',
            nodes: [
                { id: 'A', label: 'Dot A' },
                { id: 'B', label: 'Dot B' }
            ],
            links: [
                { from: 'A', to: 'B', rel: 'causes', weight: 1.0 },
                { from: 'B', to: 'A', rel: 'refutes', weight: 1.0 }
            ]
        };

        const success = setTopologyFromKGSpec(proofSpec);
        if (!success) {
            console.error('[DevKG] proof: Load failed');
            return false;
        }

        const topo = getTopology();
        const directedCount = topo.links.length;
        const springCount = topo.springs?.length || 0;
        console.log(`[DevKG] proof: directed links=${directedCount}, springs=${springCount}`);
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
