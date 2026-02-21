import type {
  KnowledgeSkeletonV1,
  SkeletonEdgeV1,
  SkeletonNodeV1
} from "./knowledgeSkeletonV1";

export type SkeletonTopologyNode = {
  id: string;
  label?: string;
  meta?: Record<string, unknown>;
};

export type SkeletonTopologyLink = {
  from: string;
  to: string;
  kind?: string;
  weight?: number;
  meta?: Record<string, unknown>;
};

function compareNodes(a: SkeletonNodeV1, b: SkeletonNodeV1): number {
  if (a.pressure !== b.pressure) return b.pressure - a.pressure;
  return a.id.localeCompare(b.id);
}

function compareEdges(a: SkeletonEdgeV1, b: SkeletonEdgeV1): number {
  if (a.weight !== b.weight) return b.weight - a.weight;
  if (a.from !== b.from) return a.from.localeCompare(b.from);
  if (a.to !== b.to) return a.to.localeCompare(b.to);
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  return a.rationale.localeCompare(b.rationale);
}

export function skeletonToTopologyCore(skeleton: KnowledgeSkeletonV1): {
  nodes: SkeletonTopologyNode[];
  links: SkeletonTopologyLink[];
} {
  const sortedNodes = [...skeleton.nodes].sort(compareNodes);
  const sortedEdges = [...skeleton.edges].sort(compareEdges);

  const nodes: SkeletonTopologyNode[] = sortedNodes.map((node) => ({
    id: node.id,
    label: node.label,
    meta: {
      role: node.role,
      summary: node.summary,
      pressure: node.pressure,
      confidence: node.confidence
    }
  }));

  const links: SkeletonTopologyLink[] = sortedEdges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    kind: edge.type,
    weight: edge.weight,
    meta: {
      rationale: edge.rationale
    }
  }));

  return { nodes, links };
}
