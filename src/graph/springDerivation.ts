/**
 * Spring Edge Derivation
 *
 * Converts directed knowledge links to undirected physics spring edges.
 * STEP 8 - RUN 3: Added physics mapping policy support.
 */

import type { Topology, SpringEdge } from './topologyTypes';
import type { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import type { PhysicsMappingPolicy } from './physicsMappingPolicy';
import { DefaultPhysicsMappingPolicy } from './physicsMappingPolicy';

/**
 * Derive undirected spring edges from directed links.
 *
 * Rules:
 * - Every directed link produces one undirected spring edge
 * - De-duplicate: A->B and B->A become one spring (min,max canonical key)
 * - Spring edge stores reference to source DirectedLink IDs for traceability
 * - STEP 8 - RUN 9: Parallel links (multiple links between same node pair) resolve deterministically:
 *   - "Strongest wins": lowest compliance (highest stiffness) dominates
 *   - All link IDs collected in contributors for traceability
 *   - All edge types tracked in meta.allEdgeTypes
 *
 * RUN 9: Now applies rest length policy to each spring edge.
 * STEP 8 - RUN 3: Added physics mapping policy (optional, defaults to baseline behavior).
 *
 * @param topology The knowledge graph
 * @param config Physics configuration (for rest length policy)
 * @param policy Physics mapping policy (optional, defaults to DefaultPhysicsMappingPolicy)
 * @returns Array of undirected spring edges for physics
 */
export function deriveSpringEdges(
    topology: Topology,
    config?: ForceConfig,
    policy?: PhysicsMappingPolicy,
    opts?: { silent?: boolean }
): SpringEdge[] {
    const edgeMap = new Map<string, SpringEdge>();
    const nodeIdSet = new Set(topology.nodes.map(n => n.id));
    const totalDirectedLinks = topology.links.length;
    const appliedConfig = config || DEFAULT_PHYSICS_CONFIG;
    const appliedPolicy = policy || DefaultPhysicsMappingPolicy;

    // STEP 8 - RUN 3: Apply policy to collect metadata
    if (!opts?.silent && import.meta.env.DEV) {
        console.groupCollapsed(`[PhysicsMappingPolicy] Using policy: ${appliedPolicy.name} v${appliedPolicy.version}`);
    }

    for (const link of topology.links) {
        // STEP 8 - RUN 3: Get policy params for this link
        const policyParams = appliedPolicy.mapLinkParams(link, {
            targetSpacing: appliedConfig.targetSpacing,
            xpbdLinkCompliance: appliedConfig.xpbdLinkCompliance,
            damping: appliedConfig.damping
        });

        // Skip if policy says no spring
        if (policyParams === undefined) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.log(`[SpringDerivation] Skipped link (policy): ${link.from} -> ${link.to} [${link.kind || 'relates'}]`);
            }
            continue;
        }

        // Skip self-loops
        if (link.from === link.to) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Skipped self-loop: ${link.from} -> ${link.to}`);
            }
            continue;
        }

        // Skip links with missing endpoints
        if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Skipped link with missing endpoint: ${link.from} -> ${link.to}`);
            }
            continue;
        }

        // Canonical key: always min(from, to) : max(from, to)
        const a = link.from < link.to ? link.from : link.to;
        const b = link.from < link.to ? link.to : link.from;
        const key = `${a}:${b}`;

        // De-duplicate
        const existing = edgeMap.get(key);
        if (existing) {
            // STEP 8 - RUN 9: Deterministic parallel link resolution
            // Rule: "Strongest wins" - use lowest scaled compliance (highest stiffness)
            const existingParams = existing.meta?.policyParams as any;
            const existingCompliance = existing.compliance ?? (existingParams?.compliance ?? 0.01);
            const weight = link.weight ?? 1.0;
            const clampedWeight = Math.max(0.1, Math.min(1.0, weight));
            const newComplianceBase = policyParams.compliance ?? 0.01;
            const newCompliance = newComplianceBase / clampedWeight;

            if (newCompliance < existingCompliance) {
                // New link is stronger, update spring params
                existing.restLen = policyParams.restLength;
                existing.stiffness = clampedWeight; // Legacy mode
                existing.compliance = newCompliance; // XPBD mode
                existing.meta = {
                    policyParams,
                    edgeType: link.kind || 'relates',
                    dampingScale: policyParams.dampingScale,
                    // Keep track of all edge types for forensics
                    allEdgeTypes: [
                        ...(existing.meta?.allEdgeTypes as string[] || []),
                        ...(existing.meta?.edgeType ? [existing.meta?.edgeType as string] : []),
                        link.kind || 'relates'
                    ]
                };

                if (import.meta.env.DEV && !opts?.silent) {
                    console.log(`[SpringDerivation] Parallel link {${a}, ${b}}: stronger type '${link.kind}' (compliance ${newCompliance} < ${existingCompliance})`);
                }
            }

            // Always add to contributors
            if (!existing.contributors) existing.contributors = [];
            if (link.id) {
                existing.contributors.push(link.id);
            }

            if (import.meta.env.DEV && !opts?.silent) {
                console.log(`[SpringDerivation] Merged spring {${a}, ${b}}: ${existing.contributors?.length || 0} contributors`);
            }
        } else {
            // STEP 8 - RUN 5/11: Use policy params for spring properties
            // Store compliance for XPBD mode
            // Keep old stiffness semantics for legacy mode (link.weight 0-1 range)

            // For XPBD: store compliance, scaled by weight (lower weight = higher compliance = softer)
            const weight = link.weight ?? 1.0;
            const clampedWeight = Math.max(0.1, Math.min(1.0, weight)); // Clamp to safe range
            const policyCompliance = policyParams.compliance ?? 0.01; // Default global compliance
            const scaledCompliance = policyCompliance / clampedWeight; // Scale compliance by weight

            // For legacy: keep old semantics (stiffness = link.weight 0-1)
            const legacyStiffness = clampedWeight;

            const spring: SpringEdge = {
                a,
                b,
                restLen: policyParams.restLength, // Use policy-computed rest length
                stiffness: legacyStiffness, // Old semantics for legacy mode
                compliance: scaledCompliance, // New field for XPBD mode
                contributors: link.id ? [link.id] : [],
                // STEP 8 - RUN 3: Store policy metadata
                meta: {
                    policyParams,
                    edgeType: link.kind || 'relates',
                    dampingScale: policyParams.dampingScale,
                    allEdgeTypes: [link.kind || 'relates'] // Track all edge types for parallel links
                }
            };
            edgeMap.set(key, spring);
        }
    }

    // STEP 8 - RUN 5: Edges already have restLen from policy, no need to computeRestLengths
    const edges = Array.from(edgeMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, edge]) => edge);

    // Collect stats for logging (counts per edge type, compliance stats)
    const edgeTypeCounts = new Map<string, number>();
    const complianceValues: number[] = [];
    for (const edge of edges) {
        const edgeType = edge.meta?.edgeType as string | undefined;
        if (edgeType) {
            edgeTypeCounts.set(edgeType, (edgeTypeCounts.get(edgeType) || 0) + 1);
        }
        if (edge.compliance !== undefined) {
            complianceValues.push(edge.compliance);
        }
    }

    // STEP5-RUN5: Numeric safety - drop invalid springs
    const validEdges: SpringEdge[] = [];
    let droppedNaN = 0;
    let droppedInvalidRestLen = 0;
    let droppedInvalidStiffness = 0;

    for (const edge of edges) {
        // Check for NaN/Infinity
        if (!isFinite(edge.restLen) || !isFinite(edge.stiffness)) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Dropped spring {${edge.a}, ${edge.b}}: NaN/Infinity (restLen=${edge.restLen}, stiffness=${edge.stiffness}, contributors=${edge.contributors?.join(', ')})`);
            }
            droppedNaN++;
            continue;
        }

        // Check restLen bounds (must be positive)
        if (edge.restLen <= 0) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Dropped spring {${edge.a}, ${edge.b}}: invalid restLen=${edge.restLen} (contributors=${edge.contributors?.join(', ')})`);
            }
            droppedInvalidRestLen++;
            continue;
        }

        // Check stiffness bounds (must be positive)
        if (edge.stiffness <= 0) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Dropped spring {${edge.a}, ${edge.b}}: invalid stiffness=${edge.stiffness} (contributors=${edge.contributors?.join(', ')})`);
            }
            droppedInvalidStiffness++;
            continue;
        }

        validEdges.push(edge);
    }

    if (!opts?.silent && (droppedNaN > 0 || droppedInvalidRestLen > 0 || droppedInvalidStiffness > 0) && import.meta.env.DEV) {
        console.warn(`[SpringDerivation] Safety: dropped ${droppedNaN} NaN/Infinity, ${droppedInvalidRestLen} invalid restLen, ${droppedInvalidStiffness} invalid stiffness`);
    }

    const dedupeRate = totalDirectedLinks > 0
        ? ((1 - validEdges.length / totalDirectedLinks) * 100).toFixed(1)
        : '0.0';

    if (!opts?.silent && import.meta.env.DEV) {
        console.log(`[Run9] deriveSpringEdges: ${totalDirectedLinks} directed links -> ${validEdges.length} spring edges (dedupe: ${dedupeRate}%)`);

        // STEP 8 - RUN 6: Policy summary logging
        if (edgeTypeCounts.size > 0) {
            const typeSummary = Array.from(edgeTypeCounts.entries())
                .map(([type, count]) => `${type}:${count}`)
                .join(', ');
            console.log(`[PhysicsMappingPolicy] Edge types: ${typeSummary}`);
        }

        if (complianceValues.length > 0) {
            const minC = Math.min(...complianceValues);
            const maxC = Math.max(...complianceValues);
            const avgC = complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length;
            console.log(`[PhysicsMappingPolicy] Compliance: min=${minC.toFixed(4)}, max=${maxC.toFixed(4)}, avg=${avgC.toFixed(4)}`);
        }

        console.groupEnd();
    }

    return validEdges;
}
