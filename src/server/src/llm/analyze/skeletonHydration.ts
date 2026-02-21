export type SkeletonHydrationNode = {
  id: string;
};

export type SkeletonPosition = {
  x: number;
  y: number;
};

export type HydratedRuntimeRole = "spine" | "rib" | "fiber";

export type HydratedTopologyNodeSpec = {
  id: string;
  label?: string;
  meta?: Record<string, unknown>;
};

export type HydratedRuntimeNode = {
  id: string;
  x: number;
  y: number;
  role: HydratedRuntimeRole;
  label: string;
  sourceTitle: string;
  sourceSummary: string;
};

function mapSkeletonRoleToRuntimeRole(role: unknown): HydratedRuntimeRole {
  if (role === "claim" || role === "context") return "spine";
  if (role === "method" || role === "evidence") return "rib";
  return "fiber";
}

export function hydrateSkeletonNodePositions(args: {
  nodes: SkeletonHydrationNode[];
  initialPositions: Record<string, SkeletonPosition>;
  spacing: number;
}): Record<string, SkeletonPosition> {
  const result: Record<string, SkeletonPosition> = {};
  for (let index = 0; index < args.nodes.length; index += 1) {
    const node = args.nodes[index];
    const pos = args.initialPositions[node.id];
    if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) {
      result[node.id] = { x: pos.x, y: pos.y };
      continue;
    }
    const fallbackAngle = (Math.PI * 2 * index) / Math.max(1, args.nodes.length);
    result[node.id] = {
      x: Number((Math.cos(fallbackAngle) * args.spacing).toFixed(6)),
      y: Number((Math.sin(fallbackAngle) * args.spacing).toFixed(6))
    };
  }
  return result;
}

export function buildHydratedRuntimeNodes(args: {
  topologyNodes: HydratedTopologyNodeSpec[];
  initialPositions: Record<string, SkeletonPosition>;
  spacing: number;
}): HydratedRuntimeNode[] {
  const hydratedPositions = hydrateSkeletonNodePositions({
    nodes: args.topologyNodes.map((node) => ({ id: node.id })),
    initialPositions: args.initialPositions,
    spacing: args.spacing
  });

  return args.topologyNodes.map((spec) => {
    const meta = spec.meta as Record<string, unknown> | undefined;
    const role = mapSkeletonRoleToRuntimeRole(meta?.role);
    const title = typeof spec.label === "string" && spec.label.trim() ? spec.label.trim() : spec.id;
    const summaryRaw = typeof meta?.summary === "string" ? meta.summary : title;
    const summary = summaryRaw.trim() || title;
    const pos = hydratedPositions[spec.id];
    return {
      id: spec.id,
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
      role,
      label: title,
      sourceTitle: title,
      sourceSummary: summary
    };
  });
}

import type { KnowledgeSkeletonV1 } from "./knowledgeSkeletonV1";
import { applyTopologyToGraphState, buildTopologyFromSkeletonCore } from "./skeletonTopologyBuild";

export function buildHydratedRuntimeSnapshot(args: {
  skeleton: KnowledgeSkeletonV1;
  seed: number;
  spacing: number;
}): {
  nodeOrder: string[];
  positionsById: Record<string, SkeletonPosition>;
  applyCalls: number;
  addNodeCalls: number;
} {
  const built = buildTopologyFromSkeletonCore(args.skeleton, { seed: args.seed });
  let applyCalls = 0;
  let appliedNodes: HydratedTopologyNodeSpec[] = [];
  const engineNodeMap = new Map<string, SkeletonPosition>();
  let addNodeCalls = 0;
  const engineMock = {
    addNode(node: { id: string; x: number; y: number }) {
      addNodeCalls += 1;
      engineNodeMap.set(node.id, {
        x: Number(node.x.toFixed(6)),
        y: Number(node.y.toFixed(6))
      });
    }
  };

  applyTopologyToGraphState({ nodes: built.nodes, links: built.links }, (topology) => {
    applyCalls += 1;
    appliedNodes = topology.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      meta: node.meta as Record<string, unknown> | undefined
    }));
  });

  const runtimeNodes = buildHydratedRuntimeNodes({
    topologyNodes: appliedNodes,
    initialPositions: built.initialPositions,
    spacing: args.spacing
  });

  runtimeNodes.forEach((node) => {
    engineMock.addNode(node);
  });

  const sortedNodeOrder = [...engineNodeMap.keys()].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  const positionsById: Record<string, SkeletonPosition> = {};
  sortedNodeOrder.forEach((nodeId) => {
    const pos = engineNodeMap.get(nodeId);
    if (!pos) return;
    positionsById[nodeId] = { x: pos.x, y: pos.y };
  });

  return {
    nodeOrder: sortedNodeOrder,
    positionsById,
    applyCalls,
    addNodeCalls
  };
}
