/**
 * KGSpec Validation
 * 
 * Structural validation for knowledge graph specifications.
 * No physics assumptions - purely validates the KGSpec format.
 */

import type { KGSpec } from './kgSpec';

/**
 * Validation result.
 * 
 * STEP5-RUN2: Added normalizedSpec for graceful degradation.
 */
export interface ValidationResult {
    /** Whether the spec is valid */
    ok: boolean;

    /** Fatal errors that prevent loading */
    errors: string[];

    /** Non-fatal warnings */
    warnings: string[];

    /** STEP5-RUN2: Normalized/clamped spec (if warnings exist) */
    normalizedSpec?: KGSpec;
}

/**
 * Validate a KGSpec for structural correctness.
 * 
 * Checks:
 * - specVersion is valid
 * - No duplicate node IDs
 * - No missing node IDs in links
 * - No self-loops
 * - Required fields present
 * 
 * Does NOT check:
 * - Physics constraints
 * - Semantic correctness of relationships
 * 
 * @param spec The KGSpec to validate
 * @returns Validation result with errors and warnings
 */
export function validateKGSpec(spec: KGSpec): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check specVersion
    if (!spec.specVersion) {
        errors.push('Missing specVersion');
    } else if (spec.specVersion !== 'kg/1') {
        errors.push(`Unsupported specVersion: ${spec.specVersion} (expected 'kg/1')`);
    }

    // 2. Check nodes array
    if (!spec.nodes || !Array.isArray(spec.nodes)) {
        errors.push('Missing or invalid nodes array');
        return { ok: false, errors, warnings }; // Cannot continue validation
    }

    // 3. Check for missing node IDs
    const nodesWithoutId = spec.nodes.filter(n => !n.id || typeof n.id !== 'string');
    if (nodesWithoutId.length > 0) {
        errors.push(`${nodesWithoutId.length} node(s) missing or invalid id`);
    }

    // 4. Check for duplicate node IDs
    const nodeIds = spec.nodes.map(n => n.id).filter(Boolean);
    const duplicates = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
        errors.push(`Duplicate node IDs: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Build node ID set for link validation
    const nodeIdSet = new Set(nodeIds);

    // 5. Check links array
    if (!spec.links || !Array.isArray(spec.links)) {
        errors.push('Missing or invalid links array');
        return { ok: false, errors, warnings };
    }

    // 6. Validate each link
    let selfLoopCount = 0;
    let missingEndpointCount = 0;
    const invalidLinks: string[] = [];

    for (let i = 0; i < spec.links.length; i++) {
        const link = spec.links[i];

        // Check required fields
        if (!link.from || !link.to) {
            invalidLinks.push(`Link ${i}: missing from/to`);
            continue;
        }

        if (!link.rel) {
            warnings.push(`Link ${i} (${link.from}→${link.to}): missing rel type`);
        }

        // Check self-loops
        if (link.from === link.to) {
            selfLoopCount++;
            invalidLinks.push(`Link ${i}: self-loop ${link.from}→${link.to}`);
            continue;
        }

        // Check missing endpoints
        if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
            missingEndpointCount++;
            const missing = [];
            if (!nodeIdSet.has(link.from)) missing.push(`from=${link.from}`);
            if (!nodeIdSet.has(link.to)) missing.push(`to=${link.to}`);
            invalidLinks.push(`Link ${i}: missing endpoints (${missing.join(', ')})`);
            continue;
        }

        // Check weight range
        if (link.weight !== undefined && (link.weight < 0 || link.weight > 1)) {
            warnings.push(`Link ${i} (${link.from}→${link.to}): weight ${link.weight} outside [0,1] range`);
        }

        // STEP5-RUN2: Check for NaN/Infinity
        if (link.weight !== undefined && !isFinite(link.weight)) {
            errors.push(`Link ${i} (${link.from}→${link.to}): weight is NaN or Infinity`);
        }
    }

    // Aggregate link errors
    if (invalidLinks.length > 0) {
        errors.push(`${invalidLinks.length} invalid link(s): ${invalidLinks.slice(0, 3).join('; ')}${invalidLinks.length > 3 ? '...' : ''}`);
    }

    if (selfLoopCount > 0) {
        errors.push(`Found ${selfLoopCount} self-loop(s)`);
    }

    if (missingEndpointCount > 0) {
        errors.push(`Found ${missingEndpointCount} link(s) with missing endpoints`);
    }

    // 7. Warnings for empty graph
    if (spec.nodes.length === 0) {
        warnings.push('Empty graph (no nodes)');
    }

    if (spec.links.length === 0) {
        warnings.push('No links in graph');
    }

    // STEP5-RUN2: Create normalized spec if warnings exist
    let normalizedSpec: KGSpec | undefined;
    if (warnings.length > 0 && errors.length === 0) {
        normalizedSpec = {
            ...spec,
            links: spec.links.map(link => ({
                ...link,
                // Clamp weight to [0, 1]
                weight: link.weight !== undefined
                    ? Math.max(0, Math.min(1, link.weight))
                    : link.weight,
                // Default rel to 'relates'
                rel: link.rel || 'relates'
            }))
        };
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        normalizedSpec
    };
}
