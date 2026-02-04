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
    throw new Error('[SECURITY] devKGHelpers loaded in production build - CHECK IMPORTS');
}

import { setTopologyFromKGSpec, exportTopologyAsKGSpec } from './kgSpecLoader';
import { validateKGSpec } from './kgSpecValidation';
import type { KGSpec } from './kgSpec';
import { EXAMPLE_KG_SPEC } from './kgSpec';

/**
 * Minimal dev helpers for KGSpec testing.
 */
export const devKGHelpers = {
    /**
     * Load a KGSpec object.
     */
    load(spec: KGSpec) {
        console.log(`[DevKG] load: attempting to load spec with ${spec.nodes?.length || 0} nodes, ${spec.links?.length || 0} links`);
        const result = setTopologyFromKGSpec(spec);
        if (!result) {
            console.error('[DevKG] Load failed - check validation errors above');
        }
        return result;
    },

    /**
     * Load a KGSpec from JSON string.
     */
    loadJson(jsonString: string) {
        console.log('[DevKG] loadJson: parsing JSON string...');
        try {
            const spec = JSON.parse(jsonString) as KGSpec;
            return devKGHelpers.load(spec);
        } catch (err) {
            console.error('[DevKG] JSON parse failed:', err);
            return false;
        }
    },

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
    console.log('[DevKG] Console helpers loaded (DEV MODE). Try: window.__kg.loadExample()');
} else if (typeof window !== 'undefined') {
    console.log('[DevKG] Helpers disabled in production build.');
}
