export const SKELETON_NODE_ROLES = [
  "claim",
  "evidence",
  "method",
  "assumption",
  "limitation",
  "context"
] as const;

export const SKELETON_EDGE_TYPES = [
  "supports",
  "depends_on",
  "produces",
  "limits",
  "challenges",
  "operationalizes"
] as const;

export type SkeletonNodeRole = (typeof SKELETON_NODE_ROLES)[number];
export type SkeletonEdgeType = (typeof SKELETON_EDGE_TYPES)[number];

export const SKELETON_V1_LIMITS = {
  nodesMin: 3,
  nodesMax: 12,
  maxLabelChars: 80,
  maxSummaryChars: 240,
  maxRationaleChars: 180
} as const;

export type SkeletonNodeV1 = {
  role: SkeletonNodeRole;
  id: string;
  label: string;
  summary: string;
  pressure: number;
  confidence: number;
};

export type SkeletonEdgeV1 = {
  from: string;
  to: string;
  type: SkeletonEdgeType;
  weight: number;
  rationale: string;
};

export type KnowledgeSkeletonV1 = {
  nodes: SkeletonNodeV1[];
  edges: SkeletonEdgeV1[];
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function trimToMax(value: string, maxChars: number): string {
  const normalized = normalizeWhitespace(value);
  if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, Math.floor(maxChars)).trim();
}

export function getSkeletonV1EdgeMax(nodeCount: number): number {
  const normalized = Number.isFinite(nodeCount) ? Math.floor(nodeCount) : 0;
  return Math.max(6, normalized * 2);
}
