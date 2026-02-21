import type { KnowledgeSkeletonV1 } from "../server/src/llm/analyze/knowledgeSkeletonV1";
import { skeletonToTopologyCore } from "../server/src/llm/analyze/knowledgeSkeletonAdapter";
import type { DirectedLink, NodeSpec } from "./topologyTypes";

export function skeletonToTopology(skeleton: KnowledgeSkeletonV1): {
  nodes: NodeSpec[];
  links: DirectedLink[];
} {
  const mapped = skeletonToTopologyCore(skeleton);
  return {
    nodes: mapped.nodes as NodeSpec[],
    links: mapped.links as DirectedLink[]
  };
}
