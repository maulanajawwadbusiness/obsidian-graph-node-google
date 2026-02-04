/**
 * Manual Mutation Provider
 *
 * Provider for individual topology mutations (addLink, removeLink, etc.).
 * Wraps existing topologyControl APIs for consistency.
 *
 * Note: The core determinism is achieved via directedLinkId.ts.
 * This provider exists for API consistency with other providers.
 */

import type { DirectedLink } from '../topologyTypes';
import type { TopologyProvider, TopologySnapshot, TopologyPatchSpec } from './providerTypes';
import { hashObject } from './hashUtils';
import { addKnowledgeLink, removeKnowledgeLink, getTopology } from '../topologyControl';

/**
 * Manual mutation specification
 */
export interface ManualMutationInput {
    /** Mutation type */
    type: 'addLink' | 'removeLink';
    /** Link to add (for addLink) */
    link?: DirectedLink;
    /** Link ID to remove (for removeLink) */
    linkId?: string;
}

/**
 * Manual Mutation Provider
 *
 * Provider for single topology mutations.
 * Stateless - each call gets current topology as implicit input.
 */
export const ManualMutationProvider: TopologyProvider<ManualMutationInput> = {
    name: 'manualMutation',

    buildSnapshot(input: ManualMutationInput): TopologySnapshot {
        // Execute mutation
        let result = '';
        switch (input.type) {
            case 'addLink':
                if (input.link) {
                    result = addKnowledgeLink(input.link);
                }
                break;
            case 'removeLink':
                if (input.linkId) {
                    removeKnowledgeLink(input.linkId);
                }
                break;
        }

        // Return resulting topology
        const topo = getTopology();
        return {
            nodes: topo.nodes,
            directedLinks: topo.links,
            meta: {
                provider: 'manualMutation',
                inputHash: hashObject(input)
            }
        };
    },

    hashInput(input: ManualMutationInput): string {
        return hashObject(input);
    }
};
