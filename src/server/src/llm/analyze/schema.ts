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

export function validateAnalyzeJson(value: unknown, nodeCount: number): AnalyzeValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) {
    return { ok: false, errors: ["root must be object"] };
  }

  const paperTitle = value.paper_title;
  if (!isString(paperTitle) || paperTitle.length === 0) {
    errors.push("paper_title must be string");
  }

  const mainPoints = value.main_points;
  if (!Array.isArray(mainPoints)) {
    errors.push("main_points must be array");
  } else {
    if (mainPoints.length !== nodeCount) {
      errors.push(`main_points length must be ${nodeCount}`);
    }
    mainPoints.forEach((point, index) => {
      if (!isObject(point)) {
        errors.push(`main_points[${index}] must be object`);
        return;
      }
      if (!isInteger(point.index)) errors.push(`main_points[${index}].index must be integer`);
      if (!isString(point.title)) errors.push(`main_points[${index}].title must be string`);
      if (!isString(point.explanation)) errors.push(`main_points[${index}].explanation must be string`);
    });
  }

  const links = value.links;
  if (!Array.isArray(links)) {
    errors.push("links must be array");
  } else {
    links.forEach((link, index) => {
      if (!isObject(link)) {
        errors.push(`links[${index}] must be object`);
        return;
      }
      if (!isInteger(link.from_index)) errors.push(`links[${index}].from_index must be integer`);
      if (!isInteger(link.to_index)) errors.push(`links[${index}].to_index must be integer`);
      if (!isString(link.type)) errors.push(`links[${index}].type must be string`);
      if (!isNumber(link.weight)) errors.push(`links[${index}].weight must be number`);
      if (!isString(link.rationale)) errors.push(`links[${index}].rationale must be string`);
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
