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

export type KnowledgeSkeletonValidationError = {
  code: string;
  message: string;
  path?: string;
};

export type KnowledgeSkeletonValidationResult =
  | { ok: true; value: KnowledgeSkeletonV1 }
  | { ok: false; errors: KnowledgeSkeletonValidationError[] };

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

function createValidationError(
  code: string,
  message: string,
  path?: string
): KnowledgeSkeletonValidationError {
  return { code, message, path };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNodeRole(value: unknown): value is SkeletonNodeRole {
  return isString(value) && (SKELETON_NODE_ROLES as readonly string[]).includes(value);
}

function isEdgeType(value: unknown): value is SkeletonEdgeType {
  return isString(value) && (SKELETON_EDGE_TYPES as readonly string[]).includes(value);
}

export function validateKnowledgeSkeletonV1Shape(raw: unknown): KnowledgeSkeletonValidationResult {
  const errors: KnowledgeSkeletonValidationError[] = [];
  if (!isObject(raw)) {
    return {
      ok: false,
      errors: [createValidationError("root_invalid", "root must be an object", "")]
    };
  }

  const nodes = raw.nodes;
  const edges = raw.edges;

  if (!Array.isArray(nodes)) {
    errors.push(createValidationError("nodes_invalid", "nodes must be an array", "nodes"));
  }
  if (!Array.isArray(edges)) {
    errors.push(createValidationError("edges_invalid", "edges must be an array", "edges"));
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const nodeItems = nodes as unknown[];
  const edgeItems = edges as unknown[];

  const parsedNodes: SkeletonNodeV1[] = [];
  const parsedEdges: SkeletonEdgeV1[] = [];

  for (let i = 0; i < nodeItems.length; i += 1) {
    const item = nodeItems[i];
    const basePath = `nodes[${i}]`;
    if (!isObject(item)) {
      errors.push(createValidationError("node_invalid", "node must be an object", basePath));
      continue;
    }

    if (!isNodeRole(item.role)) {
      errors.push(createValidationError("node_role_invalid", "node.role must be a known enum", `${basePath}.role`));
    }
    if (!isString(item.id)) {
      errors.push(createValidationError("node_id_invalid", "node.id must be a string", `${basePath}.id`));
    }
    if (!isString(item.label)) {
      errors.push(createValidationError("node_label_invalid", "node.label must be a string", `${basePath}.label`));
    }
    if (!isString(item.summary)) {
      errors.push(createValidationError("node_summary_invalid", "node.summary must be a string", `${basePath}.summary`));
    }
    if (!isFiniteNumber(item.pressure)) {
      errors.push(createValidationError("node_pressure_invalid", "node.pressure must be a finite number", `${basePath}.pressure`));
    }
    if (!isFiniteNumber(item.confidence)) {
      errors.push(createValidationError("node_confidence_invalid", "node.confidence must be a finite number", `${basePath}.confidence`));
    }

    if (
      isNodeRole(item.role) &&
      isString(item.id) &&
      isString(item.label) &&
      isString(item.summary) &&
      isFiniteNumber(item.pressure) &&
      isFiniteNumber(item.confidence)
    ) {
      const normalizedId = normalizeWhitespace(item.id);
      const normalizedLabel = normalizeWhitespace(item.label);
      const normalizedSummary = normalizeWhitespace(item.summary);
      parsedNodes.push({
        role: item.role,
        id: normalizedId,
        label: normalizedLabel,
        summary: normalizedSummary,
        pressure: item.pressure,
        confidence: item.confidence
      });
    }
  }

  for (let i = 0; i < edgeItems.length; i += 1) {
    const item = edgeItems[i];
    const basePath = `edges[${i}]`;
    if (!isObject(item)) {
      errors.push(createValidationError("edge_invalid", "edge must be an object", basePath));
      continue;
    }

    if (!isString(item.from)) {
      errors.push(createValidationError("edge_from_invalid", "edge.from must be a string", `${basePath}.from`));
    }
    if (!isString(item.to)) {
      errors.push(createValidationError("edge_to_invalid", "edge.to must be a string", `${basePath}.to`));
    }
    if (!isEdgeType(item.type)) {
      errors.push(createValidationError("edge_type_invalid", "edge.type must be a known enum", `${basePath}.type`));
    }
    if (!isFiniteNumber(item.weight)) {
      errors.push(createValidationError("edge_weight_invalid", "edge.weight must be a finite number", `${basePath}.weight`));
    }
    if (!isString(item.rationale)) {
      errors.push(createValidationError("edge_rationale_invalid", "edge.rationale must be a string", `${basePath}.rationale`));
    }

    if (
      isString(item.from) &&
      isString(item.to) &&
      isEdgeType(item.type) &&
      isFiniteNumber(item.weight) &&
      isString(item.rationale)
    ) {
      parsedEdges.push({
        from: normalizeWhitespace(item.from),
        to: normalizeWhitespace(item.to),
        type: item.type,
        weight: item.weight,
        rationale: normalizeWhitespace(item.rationale)
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { nodes: parsedNodes, edges: parsedEdges } };
}

export function validateKnowledgeSkeletonV1Semantic(
  value: KnowledgeSkeletonV1
): KnowledgeSkeletonValidationResult {
  const errors: KnowledgeSkeletonValidationError[] = [];
  const nodeCount = value.nodes.length;
  if (nodeCount < SKELETON_V1_LIMITS.nodesMin || nodeCount > SKELETON_V1_LIMITS.nodesMax) {
    errors.push(
      createValidationError(
        "node_count_out_of_range",
        `nodes length must be within ${SKELETON_V1_LIMITS.nodesMin}..${SKELETON_V1_LIMITS.nodesMax}`,
        "nodes"
      )
    );
  }

  const nodeIds = new Set<string>();
  for (let i = 0; i < value.nodes.length; i += 1) {
    const node = value.nodes[i];
    const nodePath = `nodes[${i}]`;
    if (!node.id) {
      errors.push(createValidationError("node_id_empty", "node.id must be non-empty", `${nodePath}.id`));
    }
    if (nodeIds.has(node.id)) {
      errors.push(createValidationError("node_id_duplicate", `duplicate node id: ${node.id}`, `${nodePath}.id`));
    }
    nodeIds.add(node.id);

    if (node.label.length === 0) {
      errors.push(createValidationError("node_label_empty", "node.label must be non-empty", `${nodePath}.label`));
    }
    if (node.summary.length === 0) {
      errors.push(createValidationError("node_summary_empty", "node.summary must be non-empty", `${nodePath}.summary`));
    }
    if (node.label.length > SKELETON_V1_LIMITS.maxLabelChars) {
      errors.push(
        createValidationError(
          "node_label_too_long",
          `node.label exceeds max length ${SKELETON_V1_LIMITS.maxLabelChars}`,
          `${nodePath}.label`
        )
      );
    }
    if (node.summary.length > SKELETON_V1_LIMITS.maxSummaryChars) {
      errors.push(
        createValidationError(
          "node_summary_too_long",
          `node.summary exceeds max length ${SKELETON_V1_LIMITS.maxSummaryChars}`,
          `${nodePath}.summary`
        )
      );
    }
    if (node.pressure < 0 || node.pressure > 1) {
      errors.push(createValidationError("node_pressure_out_of_range", "node.pressure must be within [0,1]", `${nodePath}.pressure`));
    }
    if (node.confidence < 0 || node.confidence > 1) {
      errors.push(
        createValidationError("node_confidence_out_of_range", "node.confidence must be within [0,1]", `${nodePath}.confidence`)
      );
    }
  }

  const edgeMax = getSkeletonV1EdgeMax(nodeCount);
  if (value.edges.length > edgeMax) {
    errors.push(createValidationError("edge_count_out_of_range", `edges length must be <= ${edgeMax}`, "edges"));
  }

  const degreeById = new Map<string, number>();
  for (const id of nodeIds) {
    degreeById.set(id, 0);
  }

  for (let i = 0; i < value.edges.length; i += 1) {
    const edge = value.edges[i];
    const edgePath = `edges[${i}]`;
    if (!edge.from || !nodeIds.has(edge.from)) {
      errors.push(createValidationError("edge_from_missing_node", "edge.from must reference an existing node id", `${edgePath}.from`));
    }
    if (!edge.to || !nodeIds.has(edge.to)) {
      errors.push(createValidationError("edge_to_missing_node", "edge.to must reference an existing node id", `${edgePath}.to`));
    }
    if (edge.from === edge.to) {
      errors.push(createValidationError("edge_self_loop", "edge self loop is not allowed", edgePath));
    }
    if (edge.weight < 0 || edge.weight > 1) {
      errors.push(createValidationError("edge_weight_out_of_range", "edge.weight must be within [0,1]", `${edgePath}.weight`));
    }
    if (edge.rationale.length === 0) {
      errors.push(createValidationError("edge_rationale_empty", "edge.rationale must be non-empty", `${edgePath}.rationale`));
    }
    if (edge.rationale.length > SKELETON_V1_LIMITS.maxRationaleChars) {
      errors.push(
        createValidationError(
          "edge_rationale_too_long",
          `edge.rationale exceeds max length ${SKELETON_V1_LIMITS.maxRationaleChars}`,
          `${edgePath}.rationale`
        )
      );
    }

    if (degreeById.has(edge.from)) {
      degreeById.set(edge.from, (degreeById.get(edge.from) || 0) + 1);
    }
    if (degreeById.has(edge.to)) {
      degreeById.set(edge.to, (degreeById.get(edge.to) || 0) + 1);
    }
  }

  let orphanCount = 0;
  for (const degree of degreeById.values()) {
    if (degree <= 0) orphanCount += 1;
  }
  if (orphanCount > 1) {
    errors.push(createValidationError("orphan_nodes_excessive", "at most one orphan node is allowed", "edges"));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value };
}

export function validateKnowledgeSkeletonV1(raw: unknown): KnowledgeSkeletonValidationResult {
  const shapeResult = validateKnowledgeSkeletonV1Shape(raw);
  if (!shapeResult.ok) return shapeResult;
  return validateKnowledgeSkeletonV1Semantic(shapeResult.value);
}

export class KnowledgeSkeletonValidationFailure extends Error {
  public readonly errors: KnowledgeSkeletonValidationError[];

  constructor(errors: KnowledgeSkeletonValidationError[]) {
    super("knowledge skeleton validation failed");
    this.name = "KnowledgeSkeletonValidationFailure";
    this.errors = errors;
  }
}

export function validateKnowledgeSkeletonV1OrThrow(raw: unknown): KnowledgeSkeletonV1 {
  const result = validateKnowledgeSkeletonV1(raw);
  if (result.ok === false) {
    throw new KnowledgeSkeletonValidationFailure(result.errors);
  }
  return result.value;
}
