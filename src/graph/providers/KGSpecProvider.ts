/**
 * KGSpec Provider
 *
 * Deterministic provider for KGSpec input.
 * Wraps existing toTopologyFromKGSpec with normalization.
 */

import type { KGSpec } from '../kgSpec';
import type { TopologyProvider } from './providerTypes';
import { toTopologyFromKGSpec } from '../kgSpecToTopology';
import { ensureDirectedLinkIds } from '../directedLinkId';
import { hashObject } from './hashUtils';

/**
 * KGSpec Provider Options
 */
export interface KGSpecProviderOptions {
    /** Whether to sort nodes/links by ID (default true) */
    sortById?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: KGSpecProviderOptions = {
    sortById: true
};

function normalizeNodes(spec: KGSpec) {
    const nodes = spec.nodes.map(node => ({
        ...node,
        label: node.label?.trim() || node.id
    }));

    const seenIds = new Set<string>();
    const duplicates: string[] = [];
    for (const node of nodes) {
        if (!node.id) {
            duplicates.push('(missing id)');
            continue;
        }
        if (seenIds.has(node.id)) {
            duplicates.push(node.id);
            continue;
        }
        seenIds.add(node.id);
    }

    if (duplicates.length > 0) {
        const sample = duplicates.slice(0, 10).join(', ');
        const suffix = duplicates.length > 10 ? ` (+${duplicates.length - 10} more)` : '';
        throw new Error(`KGSpecProvider: duplicate node id(s): ${sample}${suffix}`);
    }

    return nodes;
}

function normalizeLinks(spec: KGSpec) {
    return spec.links.map(link => ({
        ...link,
        rel: link.rel?.trim() || 'relates',
        weight: link.weight ?? 1.0
    }));
}

function buildLinkSortKey(link: ReturnType<typeof normalizeLinks>[number]): string {
    const rel = link.rel?.trim() || 'relates';
    const hash = hashObject({
        from: link.from,
        to: link.to,
        rel,
        weight: link.weight ?? 1.0,
        directed: link.directed !== false,
        meta: link.meta
    });
    return `${link.from}|${link.to}|${rel}|${hash}`;
}

function normalizeSpecForHash(nodes: ReturnType<typeof normalizeNodes>, links: ReturnType<typeof normalizeLinks>) {
    const normalizedNodes = [...nodes]
        .map(node => ({
            id: node.id,
            label: node.label?.trim() || node.id,
            kind: node.kind,
            source: node.source,
            payload: node.payload
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const normalizedLinks = [...links]
        .map(link => ({
            from: link.from,
            to: link.to,
            rel: link.rel?.trim() || 'relates',
            weight: link.weight ?? 1.0,
            directed: link.directed !== false,
            meta: link.meta
        }))
        .sort((a, b) => buildLinkSortKey(a).localeCompare(buildLinkSortKey(b)));

    return { normalizedNodes, normalizedLinks };
}

/**
 * KGSpec Topology Provider
 *
 * Produces deterministic topology from KGSpec input.
 */
export const KGSpecProvider: TopologyProvider<KGSpec> = {
    name: 'kgSpec',

    buildSnapshot(spec: KGSpec) {
        const opts = DEFAULT_OPTIONS;
        const normalizedNodes = normalizeNodes(spec);
        const normalizedLinks = normalizeLinks(spec);
        const { normalizedLinks: hashLinks, normalizedNodes: hashNodes } =
            normalizeSpecForHash(normalizedNodes, normalizedLinks);
        const inputHash = hashObject({
            specVersion: spec.specVersion,
            docId: spec.docId,
            nodes: hashNodes,
            links: hashLinks
        });

        // Convert to topology after validation
        const topology = toTopologyFromKGSpec({
            ...spec,
            nodes: normalizedNodes,
            links: normalizedLinks
        });

        // Stable sort for deterministic link IDs
        const sortedLinks = [...topology.links].sort((a, b) => {
            if (a.from !== b.from) return a.from.localeCompare(b.from);
            if (a.to !== b.to) return a.to.localeCompare(b.to);
            if ((a.kind || 'relates') !== (b.kind || 'relates')) {
                return (a.kind || 'relates').localeCompare(b.kind || 'relates');
            }
            const aKey = hashObject({
                from: a.from,
                to: a.to,
                kind: a.kind || 'relates',
                weight: a.weight ?? 1,
                meta: a.meta
            });
            const bKey = hashObject({
                from: b.from,
                to: b.to,
                kind: b.kind || 'relates',
                weight: b.weight ?? 1,
                meta: b.meta
            });
            return aKey.localeCompare(bKey);
        });

        const linksWithIds = ensureDirectedLinkIds(sortedLinks);

        if (opts.sortById) {
            topology.nodes.sort((a, b) => a.id.localeCompare(b.id));
            linksWithIds.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }

        return {
            nodes: topology.nodes,
            directedLinks: linksWithIds,
            meta: {
                provider: 'kgSpec',
                docId: spec.docId,
                inputHash
            }
        };
    },

    hashInput(spec: KGSpec): string {
        const normalizedNodes = normalizeNodes(spec);
        const normalizedLinks = normalizeLinks(spec);
        const { normalizedLinks: hashLinks, normalizedNodes: hashNodes } =
            normalizeSpecForHash(normalizedNodes, normalizedLinks);
        return hashObject({
            specVersion: spec.specVersion,
            docId: spec.docId,
            nodes: hashNodes,
            links: hashLinks
        });
    }
};
