# Knowledge Skeleton Quality Checklist

Use this rubric to evaluate whether a `KnowledgeSkeletonV1` output is glance-readable and load-bearing.

## Core Structure

- Main claim is present and clear.
- At least one evidence node directly supports the main claim.
- At least one method node exists and operationalizes or produces evidence.
- Assumption nodes exist when method transfer or interpretation depends on priors.
- Limitation nodes explicitly constrain claim or method.
- Context nodes capture external frame or institutional pressure.

## Graph Integrity

- No orphan nodes: every node has degree >= 1.
- No self loops.
- All edges reference existing node ids.
- Node ids are slug-like and stable (`lowercase`, `numbers`, `hyphen`).

## Readability

- Node count within 3..12.
- Edge count within policy cap (`<= max(6, nodeCount * 2)`).
- Labels are short and scannable.
- Summaries are concise (1-2 lines target).
- Rationales explain relationship intent, not label repetition.

## Semantic Coherence

- Evidence does not contradict claim without challenge links.
- Methods are connected to claims/evidence, not isolated islands.
- Limitations attach to affected claim/method nodes.
- Context/challenge links are explicit where interpretation shifts.
