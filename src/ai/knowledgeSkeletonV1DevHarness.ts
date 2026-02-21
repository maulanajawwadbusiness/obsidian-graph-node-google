import {
  type KnowledgeSkeletonV1,
  validateKnowledgeSkeletonV1
} from '../server/src/llm/analyze/knowledgeSkeletonV1';

const ENABLE_KNOWLEDGE_SKELETON_V1_DEV_HARNESS = false;

const DEV_FIXTURE: KnowledgeSkeletonV1 = {
  nodes: [
    {
      role: 'claim',
      id: 's1',
      label: 'Claim',
      summary: 'Short summary.',
      pressure: 0.8,
      confidence: 0.7
    },
    {
      role: 'method',
      id: 's2',
      label: 'Method',
      summary: 'Method summary.',
      pressure: 0.7,
      confidence: 0.75
    },
    {
      role: 'limitation',
      id: 's3',
      label: 'Limitation',
      summary: 'Boundary summary.',
      pressure: 0.6,
      confidence: 0.6
    }
  ],
  edges: [
    {
      from: 's2',
      to: 's1',
      type: 'operationalizes',
      weight: 0.8,
      rationale: 'Method turns claim into a measurable object.'
    },
    {
      from: 's3',
      to: 's1',
      type: 'limits',
      weight: 0.55,
      rationale: 'Boundary condition constrains the claim.'
    }
  ]
};

export function runKnowledgeSkeletonV1DevHarness(): void {
  if (!ENABLE_KNOWLEDGE_SKELETON_V1_DEV_HARNESS) return;
  const result = validateKnowledgeSkeletonV1(DEV_FIXTURE);
  if (!result.ok) {
    console.log('[KnowledgeSkeletonV1] harness invalid', result.errors);
    return;
  }
  console.log('[KnowledgeSkeletonV1] harness valid', {
    nodes: result.value.nodes.length,
    edges: result.value.edges.length
  });
}
