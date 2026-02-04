/**
 * KGSpec Loader
 * 
 * Converts KGSpec (knowledge graph) to Topology (physics-ready format).
 * Also provides ingestion and export functions.
 */

import type { KGSpec, KGNode, KGLink } from './kgSpec';
import type { Topology, DirectedLink, NodeSpec } from './topologyTypes';
import { validateKGSpec } from './kgSpecValidation';
import { setTopology, getTopology } from './topologyControl';
// STEP3-RUN5-V4-FIX1: Removed unused recomputeSprings import

/**
 * Convert KGNode to NodeSpec.
 */
function kgNodeToNodeSpec(node: KGNode): NodeSpec {
    return {
        id: node.id,
        label: node.label || node.id,
        meta: {
            kind: node.kind,
            source: node.source,
            payload: node.payload
        }
    };
}

/**
 * Convert KGLink to DirectedLink.
 */
function kgLinkToDirectedLink(link: KGLink): DirectedLink {
    return {
        from: link.from,
        to: link.to,
        kind: link.rel || 'related', // STEP3-RUN5-FIX7: Default missing rel to 'related'
        weight: link.weight || 1.0,
        meta: {
            directed: link.directed !== false, // Default true
            ...link.meta
        }
    };
}

/**
 * Convert KGSpec to Topology.
 * 
 * This is a pure function - does not mutate global state.
 * Caller should validate spec first.
 * 
 * @param spec The KGSpec to convert
 * @returns Topology object
 */
export function toTopologyFromKGSpec(spec: KGSpec): Topology {
    const topology: Topology = {
        nodes: spec.nodes.map(kgNodeToNodeSpec),
        links: spec.links.map(kgLinkToDirectedLink)
    };

    // Console proof (dev-only)
    if (import.meta.env.DEV) {
        console.log(`[KGLoader] Converted KGSpec to Topology: ${topology.nodes.length} nodes, ${topology.links.length} links`);
        console.log(`[KGLoader] Sample links (first 5):`, topology.links.slice(0, 5));
    }

    return topology;
}

/**
 * Options for topology ingestion.
 */
export interface IngestOptions {
    /** Whether to validate before loading (default true) */
    validate?: boolean;

    /** Whether to allow warnings (default true) */
    allowWarnings?: boolean;
}

/**
 * Load a KGSpec into the current topology state.
 * 
 * Validates the spec first. If validation fails, does NOT mutate current topology.
 * 
 * @param spec The KGSpec to load
 * @param opts Ingestion options
 * @returns Whether the load succeeded
 */
export function setTopologyFromKGSpec(spec: KGSpec, opts: IngestOptions = {}): boolean {
    const { validate = true, allowWarnings = true } = opts;

    // Validate first
    if (validate) {
        const result = validateKGSpec(spec);

        if (!result.ok) {
            console.warn('[KGLoader] Validation failed. Topology NOT updated.');
            console.warn(`[KGLoader] Errors (${result.errors.length}):`, result.errors);
            if (result.warnings.length > 0) {
                console.warn(`[KGLoader] Warnings (${result.warnings.length}):`, result.warnings);
            }
            return false;
        }

        if (result.warnings.length > 0 && !allowWarnings) {
            console.warn('[KGLoader] Warnings found and allowWarnings=false. Topology NOT updated.');
            console.warn(`[KGLoader] Warnings (${result.warnings.length}):`, result.warnings);
            return false;
        }

        if (result.warnings.length > 0) {
            console.log(`[KGLoader] ${result.warnings.length} warning(s):`, result.warnings);
        }
    }

    // Convert and load
    const topology = toTopologyFromKGSpec(spec);

    // STEP3-RUN5-V3-FIX2: Call setTopology ONCE - it recomputes springs internally
    // STEP3-RUN5-V5-FIX1: Pass default config for rest-length policy
    setTopology(topology, { targetSpacing: 200 });

    const finalTopology = getTopology(); // Get the topology with recomputed springs
    console.log(`[KGLoader] ✓ Loaded KGSpec (${spec.specVersion}): ${spec.nodes.length} nodes, ${spec.links.length} links`);
    console.log(`[KGLoader] ✓ Springs recomputed: ${finalTopology.springs?.length || 0} springs from directed links`);
    if (spec.docId) {
        console.log(`[KGLoader] Source docId: ${spec.docId}`);
    }

    return true;
}

/**
 * Export current topology as KGSpec.
 * Useful for debug, save/load, and roundtrip testing.
 * 
 * @param topology Optional topology (defaults to current)
 * @returns KGSpec representation
 */
export function exportTopologyAsKGSpec(topology?: Topology): KGSpec {
    const topo = topology || getTopology();

    const spec: KGSpec = {
        specVersion: 'kg/1',
        nodes: topo.nodes.map(node => ({
            id: node.id,
            label: node.label || node.id,
            kind: node.meta?.kind as string | undefined,
            source: node.meta?.source as any,
            payload: node.meta?.payload as any
        })),
        links: topo.links.map(link => ({
            from: link.from,
            to: link.to,
            rel: link.kind || 'relates',
            weight: link.weight,
            directed: link.meta?.directed !== false,
            meta: link.meta
        })),
        provenance: {
            generator: 'exportTopologyAsKGSpec',
            timestamp: new Date().toISOString()
        }
    };

    console.log(`[KGLoader] Exported topology as KGSpec: ${spec.nodes.length} nodes, ${spec.links.length} links`);

    return spec;
}
