import {
  type KnowledgeSkeletonV1,
  type KnowledgeSkeletonValidationError,
  validateKnowledgeSkeletonV1,
  validateKnowledgeSkeletonV1Semantic
} from '../server/src/llm/analyze/knowledgeSkeletonV1';

export class KnowledgeSkeletonParseError extends Error {
  public readonly errors: KnowledgeSkeletonValidationError[];

  constructor(errors: KnowledgeSkeletonValidationError[]) {
    super('knowledge skeleton parse failed');
    this.name = 'KnowledgeSkeletonParseError';
    this.errors = errors;
  }
}

function formatErrors(errors: KnowledgeSkeletonValidationError[]): string {
  return errors
    .map((entry) => {
      const path = entry.path ? `${entry.path}: ` : '';
      return `${path}${entry.code}`;
    })
    .join('; ');
}

export function assertSemanticKnowledgeSkeletonV1(value: KnowledgeSkeletonV1): void {
  const semantic = validateKnowledgeSkeletonV1Semantic(value);
  if (semantic.ok) return;
  throw new KnowledgeSkeletonParseError(semantic.errors);
}

export function parseKnowledgeSkeletonV1Response(raw: unknown): KnowledgeSkeletonV1 {
  const result = validateKnowledgeSkeletonV1(raw);
  if (result.ok) {
    return result.value;
  }

  const message = formatErrors(result.errors);
  const error = new KnowledgeSkeletonParseError(result.errors);
  error.message = message ? `knowledge skeleton parse failed: ${message}` : 'knowledge skeleton parse failed';
  throw error;
}
