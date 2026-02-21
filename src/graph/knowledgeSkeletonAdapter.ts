import type { KnowledgeSkeletonV1 } from "../server/src/llm/analyze/knowledgeSkeletonV1";
import {
  buildTopologyFromSkeletonCore,
  type SkeletonPlacementOptions
} from "../server/src/llm/analyze/skeletonTopologyBuild";
import type { DirectedLink, NodeSpec } from "./topologyTypes";

export function skeletonToTopology(skeleton: KnowledgeSkeletonV1): {
  nodes: NodeSpec[];
  links: DirectedLink[];
} {
  const mapped = buildTopologyFromSkeletonCore(skeleton);
  return {
    nodes: mapped.nodes,
    links: mapped.links
  };
}

export function buildTopologyFromSkeleton(
  skeleton: KnowledgeSkeletonV1,
  opts?: SkeletonPlacementOptions
): {
  nodes: NodeSpec[];
  links: DirectedLink[];
  initialPositions: Record<string, { x: number; y: number }>;
} {
  const mapped = buildTopologyFromSkeletonCore(skeleton, opts);
  return {
    nodes: mapped.nodes,
    links: mapped.links,
    initialPositions: mapped.initialPositions
  };
}
