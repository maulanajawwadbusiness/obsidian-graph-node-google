/**
 * Manual Mutation Provider
 *
 * Provider for individual topology mutations (addLink, removeLink, etc.).
 * Wraps existing topologyControl APIs for consistency.
 *
 * Note: The core determinism is achieved via directedLinkId.ts.
 * This provider exists for API consistency with other providers.
 */

import type { DirectedLink, Topology } from '../topologyTypes';
import type { TopologyProvider, TopologySnapshot } from './providerTypes';
import { hashObject } from './hashUtils';

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
        void input;
        throw new Error('ManualMutationProvider does not support snapshots; use buildPatch');
    },

    buildPatch(prev: Topology, input: ManualMutationInput) {
        void prev;
        switch (input.type) {
            case 'addLink':
                return input.link ? { addLinks: [input.link] } : {};
            case 'removeLink':
                return input.linkId ? { removeLinkIds: [input.linkId] } : {};
            default:
                return {};
        }
    },

    hashInput(input: ManualMutationInput): string {
        return hashObject(input);
    }
};
