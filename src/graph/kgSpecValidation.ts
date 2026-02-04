/**
 * KGSpec Validation
 * 
 * Structural validation for knowledge graph specifications.
 * No physics assumptions - purely validates the KGSpec format.
 */

import type { KGSpec } from './kgSpec';

const KNOWN_REL_TYPES = new Set([
    'relates',
    'causes',
    'supports',
    'contradicts',
    'mitigates',
    'refutes',
    'evidence',
    'references'
]);

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
    let needsNormalization = false;
    let trimmedNodeIdCount = 0;
    const trimmedNodeIdSamples: string[] = [];
    let trimmedLinkEndpointCount = 0;
    const trimmedLinkEndpointSamples: string[] = [];
    let trimmedRelCount = 0;
    const trimmedRelSamples: string[] = [];

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

    // 3. Normalize node IDs (trim) and check for missing/invalid
    const normalizedNodes = spec.nodes.map(node => {
        const rawId = node.id;
        const trimmedId = typeof rawId === 'string' ? rawId.trim() : rawId;
        if (typeof rawId === 'string' && rawId !== trimmedId) {
            needsNormalization = true;
            trimmedNodeIdCount++;
            if (trimmedNodeIdSamples.length < 2) {
                trimmedNodeIdSamples.push(`${rawId} -> ${trimmedId}`);
            }
        }
        return { ...node, id: trimmedId as any };
    });

    const nodesWithoutId = normalizedNodes.filter(n => !n.id || typeof n.id !== 'string');
    if (nodesWithoutId.length > 0) {
        errors.push(`${nodesWithoutId.length} node(s) missing or invalid id`);
    }

    // 4. Check for duplicate node IDs
    const nodeIds = normalizedNodes.map(n => n.id).filter(Boolean);
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
        const rawFrom = link.from;
        const rawTo = link.to;
        const rawRel = link.rel;

        const trimmedFrom = typeof rawFrom === 'string' ? rawFrom.trim() : rawFrom;
        const trimmedTo = typeof rawTo === 'string' ? rawTo.trim() : rawTo;
        const trimmedRel = typeof rawRel === 'string' ? rawRel.trim() : rawRel;

        if (typeof rawFrom === 'string' && rawFrom !== trimmedFrom) {
            needsNormalization = true;
            trimmedLinkEndpointCount++;
            if (trimmedLinkEndpointSamples.length < 2) {
                trimmedLinkEndpointSamples.push(`from:${rawFrom} -> ${trimmedFrom}`);
            }
        }

        if (typeof rawTo === 'string' && rawTo !== trimmedTo) {
            needsNormalization = true;
            trimmedLinkEndpointCount++;
            if (trimmedLinkEndpointSamples.length < 2) {
                trimmedLinkEndpointSamples.push(`to:${rawTo} -> ${trimmedTo}`);
            }
        }

        if (typeof rawRel === 'string' && rawRel !== trimmedRel) {
            needsNormalization = true;
            trimmedRelCount++;
            if (trimmedRelSamples.length < 2) {
                trimmedRelSamples.push(`${rawRel} -> ${trimmedRel}`);
            }
        }

        // Check required fields
        if (!trimmedFrom || !trimmedTo) {
            invalidLinks.push(`Link ${i}: missing from/to`);
            continue;
        }

        if (!trimmedRel) {
            warnings.push(`Link ${i} (${trimmedFrom}->${trimmedTo}): missing rel type`);
        } else if (!KNOWN_REL_TYPES.has(trimmedRel)) {
            warnings.push(`Link ${i} (${trimmedFrom}->${trimmedTo}): unknown rel '${trimmedRel}'`);
        }

        // Check self-loops
        if (trimmedFrom === trimmedTo) {
            selfLoopCount++;
            invalidLinks.push(`Link ${i}: self-loop ${trimmedFrom}->${trimmedTo}`);
            continue;
        }

        // Check missing endpoints
        if (!nodeIdSet.has(trimmedFrom) || !nodeIdSet.has(trimmedTo)) {
            missingEndpointCount++;
            const missing = [];
            if (!nodeIdSet.has(trimmedFrom)) missing.push(`from=${trimmedFrom}`);
            if (!nodeIdSet.has(trimmedTo)) missing.push(`to=${trimmedTo}`);
            invalidLinks.push(`Link ${i}: missing endpoints (${missing.join(', ')})`);
            continue;
        }

        // Check weight range
        if (link.weight !== undefined && (link.weight < 0 || link.weight > 1)) {
            warnings.push(`Link ${i} (${trimmedFrom}->${trimmedTo}): weight ${link.weight} outside [0,1] range`);
        }

        // STEP5-RUN2: Check for NaN/Infinity
        if (link.weight !== undefined && !isFinite(link.weight)) {
            errors.push(`Link ${i} (${trimmedFrom}->${trimmedTo}): weight is NaN or Infinity`);
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
    if ((warnings.length > 0 || needsNormalization) && errors.length === 0) {
        if (trimmedNodeIdCount > 0) {
            warnings.push(
                `Trimmed ${trimmedNodeIdCount} node id(s) (e.g., ${trimmedNodeIdSamples.join(', ')})`
            );
        }
        if (trimmedLinkEndpointCount > 0) {
            warnings.push(
                `Trimmed ${trimmedLinkEndpointCount} link endpoint(s) (e.g., ${trimmedLinkEndpointSamples.join(', ')})`
            );
        }
        if (trimmedRelCount > 0) {
            warnings.push(
                `Trimmed ${trimmedRelCount} rel value(s) (e.g., ${trimmedRelSamples.join(', ')})`
            );
        }

        normalizedSpec = {
            ...spec,
            nodes: normalizedNodes.map(node => ({
                ...node,
                id: typeof node.id === 'string' ? node.id.trim() : node.id
            })),
            links: spec.links.map(link => ({
                ...link,
                from: typeof link.from === 'string' ? link.from.trim() : link.from,
                to: typeof link.to === 'string' ? link.to.trim() : link.to,
                // Clamp weight to [0, 1]
                weight: link.weight !== undefined
                    ? Math.max(0, Math.min(1, link.weight))
                    : link.weight,
                // Default rel to 'relates'
                rel: (typeof link.rel === 'string' ? link.rel.trim() : link.rel) || 'relates'
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
