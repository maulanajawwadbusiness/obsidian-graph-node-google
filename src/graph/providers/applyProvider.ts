/**
 * Apply Provider
 *
 * Functions to apply provider output to topology via existing seam.
 */

import type { Topology } from '../topologyTypes';
import type { ProviderMetadata, ProviderApplyResult } from './providerTypes';
import { getProvider } from './providerRegistry';
import { setTopology, patchTopology, getTopologyVersion } from '../topologyControl';
import { truncateHash } from './hashUtils';

/**
 * Apply topology from a provider.
 *
 * @param providerName Name of registered provider
 * @param input Provider-specific input
 * @param meta Optional metadata (docId, etc.)
 * @returns Apply result
 */
export function applyTopologyFromProvider<TInput = unknown>(
    providerName: string,
    input: TInput,
    meta?: Partial<ProviderMetadata>
): ProviderApplyResult {
    const provider = getProvider(providerName);
    if (!provider) {
        console.error(`[Provider] Unknown provider: ${providerName}`);
        return {
            changed: false,
            rejected: true,
            rejectionReason: `Unknown provider: ${providerName}`
        };
    }

    const versionBefore = getTopologyVersion();

    // Hash input for observability
    const inputHash = provider.hashInput
        ? provider.hashInput(input)
        : truncateHash(JSON.stringify(input).slice(0, 64));

    // Build snapshot
    const snapshot = provider.buildSnapshot(input);

    // Merge metadata
    const providerMeta: ProviderMetadata = {
        provider: provider.name,
        ...snapshot.meta,
        ...meta,
        inputHash
    };

    // Console output (dev-only, single groupCollapsed)
    if (import.meta.env.DEV) {
        const nodeCount = snapshot.nodes.length;
        const linkCount = snapshot.directedLinks.length;
        console.groupCollapsed(
            `[Provider] ${providerName} (hash=${inputHash}) ` +
            `N=${nodeCount} L=${linkCount} docId=${providerMeta.docId || 'none'}`
        );
        console.log({
            provider: providerName,
            inputHash,
            docId: providerMeta.docId,
            nodes: nodeCount,
            links: linkCount
        });
        console.groupEnd();
    }

    // Convert snapshot to topology and apply
    const topology: Topology = {
        nodes: snapshot.nodes,
        links: snapshot.directedLinks
    };

    // Apply via existing seam (STEP7-RUN5: include provider metadata)
    setTopology(topology, undefined, {
        source: 'topologyProvider',
        docId: providerMeta.docId,
        providerName: providerName,
        inputHash
    });

    const versionAfter = getTopologyVersion();
    const changed = versionAfter !== versionBefore;

    return {
        changed,
        rejected: false,
        version: versionAfter
    };
}

/**
 * Apply a patch from a provider.
 *
 * @param providerName Name of registered provider
 * @param input Provider-specific input
 * @param meta Optional metadata
 * @returns Apply result
 */
export function applyPatchFromProvider<TInput = unknown>(
    providerName: string,
    input: TInput,
    _meta?: Partial<ProviderMetadata>
): ProviderApplyResult {
    const provider = getProvider(providerName);
    if (!provider) {
        console.error(`[Provider] Unknown provider: ${providerName}`);
        return {
            changed: false,
            rejected: true,
            rejectionReason: `Unknown provider: ${providerName}`
        };
    }

    if (!provider.buildPatch) {
        console.error(`[Provider] Provider '${providerName}' does not support patches`);
        return {
            changed: false,
            rejected: true,
            rejectionReason: `Provider does not support patches`
        };
    }

    const versionBefore = getTopologyVersion();
    const currentTopo = getTopology();

    if (!currentTopo) {
        return {
            changed: false,
            rejected: true,
            rejectionReason: 'Cannot get current topology'
        };
    }

    // Hash input
    const inputHash = provider.hashInput
        ? provider.hashInput(input)
        : truncateHash(JSON.stringify(input).slice(0, 64));

    // Build patch
    const patchSpec = provider.buildPatch(currentTopo, input);

    // Console output
    if (import.meta.env.DEV) {
        console.groupCollapsed(
            `[Provider] ${providerName} PATCH (hash=${inputHash}) ` +
            `addN=${patchSpec.addNodes?.length || 0} ` +
            `rmN=${patchSpec.removeNodes?.length || 0} ` +
            `addL=${patchSpec.addLinks?.length || 0} ` +
            `rmL=${patchSpec.removeLinkIds?.length || 0}`
        );
        console.log({ provider: providerName, inputHash, patch: patchSpec });
        console.groupEnd();
    }

    // Apply via existing seam
    patchTopology(patchSpec);

    const versionAfter = getTopologyVersion();
    const changed = versionAfter !== versionBefore;

    return {
        changed,
        rejected: false,
        version: versionAfter
    };
}

// Import getTopology for patch function
import { getTopology } from '../topologyControl';
