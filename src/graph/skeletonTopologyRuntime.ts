import type { ForceConfig } from "../physics/types";
import type { KnowledgeSkeletonV1 } from "../server/src/llm/analyze/knowledgeSkeletonV1";
import {
  applyTopologyToGraphState,
  buildTopologyFromSkeletonCore,
  type SkeletonPlacementOptions
} from "../server/src/llm/analyze/skeletonTopologyBuild";
import type { DirectedLink, NodeSpec, Topology } from "./topologyTypes";
import { setTopology, type MutationMeta } from "./topologyControl";

export type BuildSkeletonTopologyResult = {
  topology: {
    nodes: NodeSpec[];
    links: DirectedLink[];
  };
  initialPositions: Record<string, { x: number; y: number }>;
  summary: {
    nodeCount: number;
    linkCount: number;
    firstNodeId: string | null;
  };
};

export type SkeletonRuntimeApi = {
  applyTopology: (topology: Topology, config?: ForceConfig, meta?: MutationMeta) => void;
};

const DEFAULT_RUNTIME_API: SkeletonRuntimeApi = {
  applyTopology: (topology, config, meta) => setTopology(topology, config, meta)
};

export function buildTopologyFromSkeleton(
  skeleton: KnowledgeSkeletonV1,
  opts?: SkeletonPlacementOptions
): BuildSkeletonTopologyResult {
  const built = buildTopologyFromSkeletonCore(skeleton, opts);
  const topology = {
    nodes: built.nodes as NodeSpec[],
    links: built.links as DirectedLink[]
  };
  return {
    topology,
    initialPositions: built.initialPositions,
    summary: {
      nodeCount: topology.nodes.length,
      linkCount: topology.links.length,
      firstNodeId: topology.nodes[0]?.id ?? null
    }
  };
}

export function applySkeletonTopologyToRuntime(
  skeleton: KnowledgeSkeletonV1,
  options?: {
    placement?: SkeletonPlacementOptions;
    runtimeApi?: SkeletonRuntimeApi;
    config?: ForceConfig;
    meta?: MutationMeta;
  }
): BuildSkeletonTopologyResult {
  const built = buildTopologyFromSkeleton(skeleton, options?.placement);
  const runtimeApi = options?.runtimeApi ?? DEFAULT_RUNTIME_API;

  applyTopologyToGraphState(built.topology, (topology) => {
    runtimeApi.applyTopology(
      topology as Topology,
      options?.config,
      options?.meta ?? { source: "setTopology" }
    );
  });

  return built;
}
