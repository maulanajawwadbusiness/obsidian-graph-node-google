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
            if (!existing.contributors) existing.contributors = [];
            if (link.id) {
                existing.contributors.push(link.id);
            }

            if (import.meta.env.DEV && !opts?.silent) {
                console.log(`[SpringDerivation] Merged spring {${a}, ${b}}: ${existing.contributors?.length || 0} contributors`);
            }
        } else {
            // STEP 8 - RUN 5: Use policy params for spring properties
            // Convert compliance (inverse stiffness) to stiffness
            const policyStiffness = policyParams.compliance > 0
                ? 1.0 / policyParams.compliance
                : 1000; // Cap at very high stiffness for near-zero compliance

            // Scale by link weight if present (semantic confidence)
            const weight = link.weight ?? 1.0;
            const finalStiffness = policyStiffness * weight;

            const spring: SpringEdge = {
                a,
                b,
                restLen: policyParams.restLength, // Use policy-computed rest length
                stiffness: finalStiffness, // Use policy-computed stiffness
                contributors: link.id ? [link.id] : [],
                // STEP 8 - RUN 3: Store policy metadata
                meta: {
                    policyParams,
                    edgeType: link.kind || 'relates',
                    dampingScale: policyParams.dampingScale
                }
            };
            edgeMap.set(key, spring);
        }
    }

    // STEP 8 - RUN 5: Edges already have restLen from policy, no need to computeRestLengths
    const edges = Array.from(edgeMap.values());

    // Collect stats for logging (counts per edge type, compliance stats)
    const edgeTypeCounts = new Map<string, number>();
    const complianceValues: number[] = [];
    for (const edge of edges) {
        const policy = edge.meta?.policyParams as any;
        if (policy?.edgeType) {
            edgeTypeCounts.set(policy.edgeType, (edgeTypeCounts.get(policy.edgeType) || 0) + 1);
        }
        if (policy?.compliance !== undefined) {
            complianceValues.push(policy.compliance);
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
