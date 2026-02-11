export type AnalyzeMainPoint = {
  index: number;
  title: string;
  explanation: string;
};

export type AnalyzeLink = {
  from_index: number;
  to_index: number;
  type: string;
  weight: number;
  rationale: string;
};

export type AnalyzeResult = {
  paper_title: string;
  main_points: AnalyzeMainPoint[];
  links: AnalyzeLink[];
};

export type AnalyzeValidationError = {
  ok: false;
  errors: string[];
};

export type AnalyzeValidationOk = {
  ok: true;
  value: AnalyzeResult;
};

export type AnalyzeValidationResult = AnalyzeValidationOk | AnalyzeValidationError;

export function buildAnalyzeJsonSchema(nodeCount: number): object {
  return {
    type: "object",
    properties: {
      paper_title: { type: "string" },
      main_points: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            title: { type: "string" },
            explanation: { type: "string" }
          },
          required: ["index", "title", "explanation"],
          additionalProperties: false
        },
        minItems: nodeCount,
        maxItems: nodeCount
      },
      links: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from_index: { type: "integer" },
            to_index: { type: "integer" },
            type: { type: "string" },
            weight: { type: "number" },
            rationale: { type: "string" }
          },
          required: ["from_index", "to_index", "type", "weight", "rationale"],
          additionalProperties: false
        }
      }
    },
    required: ["paper_title", "main_points", "links"],
    additionalProperties: false
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateAnalyzeJson(value: unknown, nodeCount: number): AnalyzeValidationResult {
  const errors: string[] = [];
  const normalizedNodeCount = Math.max(2, Math.min(12, Math.floor(nodeCount)));
  const minLinksRequired = Math.max(1, normalizedNodeCount - 1);
  if (!isObject(value)) {
    return { ok: false, errors: ["root must be object"] };
  }

  const paperTitle = value.paper_title;
  if (!isNonEmptyString(paperTitle)) {
    errors.push("paper_title must be non-empty string");
  }

  const mainPoints = value.main_points;
  const seenPointIndices = new Set<number>();
  if (!Array.isArray(mainPoints)) {
    errors.push("main_points must be array");
  } else {
    if (mainPoints.length !== normalizedNodeCount) {
      errors.push(`main_points length must be ${normalizedNodeCount}`);
    }
    mainPoints.forEach((point, index) => {
      if (!isObject(point)) {
        errors.push(`main_points[${index}] must be object`);
        return;
      }
      if (!isInteger(point.index)) {
        errors.push(`main_points[${index}].index must be integer`);
      } else {
        if (point.index < 0 || point.index >= normalizedNodeCount) {
          errors.push(`main_points[${index}].index out of range`);
        }
        if (seenPointIndices.has(point.index)) {
          errors.push(`main_points index duplicate: ${point.index}`);
        }
        seenPointIndices.add(point.index);
      }

      if (!isNonEmptyString(point.title)) {
        errors.push(`main_points[${index}].title must be non-empty string`);
      } else if (point.title.trim().length < 6) {
        errors.push(`main_points[${index}].title too short`);
      }

      if (!isNonEmptyString(point.explanation)) {
        errors.push(`main_points[${index}].explanation must be non-empty string`);
      } else if (point.explanation.trim().length < 80) {
        errors.push(`main_points[${index}].explanation too short`);
      }

      if (isNonEmptyString(point.title) && isNonEmptyString(point.explanation)) {
        if (normalizeText(point.title) === normalizeText(point.explanation)) {
          errors.push(`main_points[${index}] explanation duplicates title`);
        }
      }
    });
    for (let expectedIndex = 0; expectedIndex < normalizedNodeCount; expectedIndex += 1) {
      if (!seenPointIndices.has(expectedIndex)) {
        errors.push(`main_points missing index ${expectedIndex}`);
      }
    }
  }

  const links = value.links;
  const seenPairs = new Set<string>();
  if (!Array.isArray(links)) {
    errors.push("links must be array");
  } else {
    if (links.length < minLinksRequired) {
      errors.push(`links length must be at least ${minLinksRequired}`);
    }
    links.forEach((link, index) => {
      if (!isObject(link)) {
        errors.push(`links[${index}] must be object`);
        return;
      }
      if (!isInteger(link.from_index)) {
        errors.push(`links[${index}].from_index must be integer`);
      } else if (link.from_index < 0 || link.from_index >= normalizedNodeCount) {
        errors.push(`links[${index}].from_index out of range`);
      }

      if (!isInteger(link.to_index)) {
        errors.push(`links[${index}].to_index must be integer`);
      } else if (link.to_index < 0 || link.to_index >= normalizedNodeCount) {
        errors.push(`links[${index}].to_index out of range`);
      }

      if (isInteger(link.from_index) && isInteger(link.to_index)) {
        if (link.from_index === link.to_index) {
          errors.push(`links[${index}] self-link is not allowed`);
        }
        const pairKey = `${link.from_index}->${link.to_index}`;
        if (seenPairs.has(pairKey)) {
          errors.push(`links[${index}] duplicate edge ${pairKey}`);
        }
        seenPairs.add(pairKey);
      }

      if (!isNonEmptyString(link.type)) {
        errors.push(`links[${index}].type must be non-empty string`);
      } else if (link.type.trim().length < 2) {
        errors.push(`links[${index}].type too short`);
      }

      if (!isNumber(link.weight)) {
        errors.push(`links[${index}].weight must be number`);
      } else if (link.weight < 0 || link.weight > 1) {
        errors.push(`links[${index}].weight must be in [0,1]`);
      }

      if (!isNonEmptyString(link.rationale)) {
        errors.push(`links[${index}].rationale must be non-empty string`);
      } else if (link.rationale.trim().length < 20) {
        errors.push(`links[${index}].rationale too short`);
      }
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      paper_title: paperTitle as string,
      main_points: mainPoints as AnalyzeMainPoint[],
      links: links as AnalyzeLink[]
    }
  };
}
