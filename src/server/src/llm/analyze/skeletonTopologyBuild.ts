import type { KnowledgeSkeletonV1 } from "./knowledgeSkeletonV1";
import { skeletonToTopologyCore } from "./knowledgeSkeletonAdapter";

export type SkeletonPlacementOptions = {
  seed?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  jitter?: number;
};

export type SkeletonInitialPosition = {
  x: number;
  y: number;
};

export type SkeletonTopologyBuildResult = {
  nodes: Array<{
    id: string;
    label?: string;
    meta?: Record<string, unknown>;
  }>;
  links: Array<{
    from: string;
    to: string;
    kind?: string;
    weight?: number;
    meta?: Record<string, unknown>;
  }>;
  initialPositions: Record<string, SkeletonInitialPosition>;
};

const DEFAULT_SEED = 1337;
const DEFAULT_CENTER_X = 0;
const DEFAULT_CENTER_Y = 0;
const DEFAULT_RADIUS = 220;
const DEFAULT_JITTER = 18;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildInitialPositions(nodeIds: string[], opts?: SkeletonPlacementOptions): Record<string, SkeletonInitialPosition> {
  const seed = Number.isFinite(opts?.seed) ? Number(opts?.seed) : DEFAULT_SEED;
  const centerX = Number.isFinite(opts?.centerX) ? Number(opts?.centerX) : DEFAULT_CENTER_X;
  const centerY = Number.isFinite(opts?.centerY) ? Number(opts?.centerY) : DEFAULT_CENTER_Y;
  const radius = Number.isFinite(opts?.radius) ? Math.max(20, Number(opts?.radius)) : DEFAULT_RADIUS;
  const jitter = Number.isFinite(opts?.jitter) ? Math.max(0, Number(opts?.jitter)) : DEFAULT_JITTER;

  const rand = mulberry32(seed);
  const count = Math.max(1, nodeIds.length);
  const positions: Record<string, SkeletonInitialPosition> = {};
  for (let i = 0; i < nodeIds.length; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const radialJitter = (rand() - 0.5) * jitter;
    const tangentialJitter = (rand() - 0.5) * jitter;
    const x = centerX + Math.cos(angle) * (radius + radialJitter) - Math.sin(angle) * tangentialJitter;
    const y = centerY + Math.sin(angle) * (radius + radialJitter) + Math.cos(angle) * tangentialJitter;
    positions[nodeIds[i]] = {
      x: Number(x.toFixed(6)),
      y: Number(y.toFixed(6))
    };
  }
  return positions;
}

function assertNoLoss(
  skeleton: KnowledgeSkeletonV1,
  nodes: Array<{ id: string }>,
  links: Array<{ from: string; to: string }>
): void {
  if (nodes.length !== skeleton.nodes.length) {
    throw new Error("skeleton_to_topology_node_count_mismatch");
  }
  if (links.length !== skeleton.edges.length) {
    throw new Error("skeleton_to_topology_edge_count_mismatch");
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const link of links) {
    if (!nodeIds.has(link.from) || !nodeIds.has(link.to)) {
      throw new Error("skeleton_to_topology_missing_endpoint");
    }
  }
}

export function buildTopologyFromSkeletonCore(
  skeleton: KnowledgeSkeletonV1,
  opts?: SkeletonPlacementOptions
): SkeletonTopologyBuildResult {
  const mapped = skeletonToTopologyCore(skeleton);
  const nodes = mapped.nodes;
  const links = mapped.links;
  assertNoLoss(skeleton, nodes, links);
  const initialPositions = buildInitialPositions(nodes.map((n) => n.id), opts);
  return {
    nodes,
    links,
    initialPositions
  };
}

export function applyTopologyToGraphState(
  topology: {
    nodes: Array<{ id: string; label?: string; meta?: Record<string, unknown> }>;
    links: Array<{ from: string; to: string; kind?: string; weight?: number; meta?: Record<string, unknown> }>;
  },
  apply: (value: {
    nodes: Array<{ id: string; label?: string; meta?: Record<string, unknown> }>;
    links: Array<{ from: string; to: string; kind?: string; weight?: number; meta?: Record<string, unknown> }>;
  }) => void
): void {
  apply({
    nodes: [...topology.nodes],
    links: [...topology.links]
  });
}
