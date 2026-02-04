# Topology API Guide (For New Coders)

Date: 2026-02-04
Purpose: Explain how to define graph topology, how the API works, and how AI wiring currently drives the map.

## 1. What is Topology Here
Topology is the authoritative graph definition: nodes (dots) and directed links.
The physics layer derives undirected springs from these directed links.

Key types:
- NodeSpec: id + label + optional meta
- DirectedLink: from + to + kind + weight
- SpringEdge: derived, undirected physics spring (a,b,restLen,...)

## 2. The Only Legal Mutation Seam
All topology changes must go through these functions:
- setTopology(topology, config, meta) in src/graph/topologyControl.ts
- patchTopology(patch, config) in src/graph/topologyControl.ts

Never mutate topology data directly.

## 3. Minimal Example (Manual Topology)
Example: build a small directed map.

Nodes:
- n1, n2, n3, n4
Links:
- n1 -> n2
- n1 -> n3
- n3 -> n4

Code shape:

const topology = {
  nodes: [
    { id: 'n1', label: 'Node 1' },
    { id: 'n2', label: 'Node 2' },
    { id: 'n3', label: 'Node 3' },
    { id: 'n4', label: 'Node 4' }
  ],
  links: [
    { from: 'n1', to: 'n2', kind: 'manual', weight: 1.0 },
    { from: 'n1', to: 'n3', kind: 'manual', weight: 1.0 },
    { from: 'n3', to: 'n4', kind: 'manual', weight: 1.0 }
  ]
};

setTopology(topology, DEFAULT_PHYSICS_CONFIG);

## 4. How Links Become Springs
- Links are directed (A->B, B->A are distinct).
- Physics uses undirected springs (one per {A,B} pair).
- deriveSpringEdges(...) deduplicates and chooses the strongest parallel link.

## 5. Where AI Builds the Graph Today
AI analysis now creates directed links and applies them to topology.

Flow:
1) Document uploaded -> parsed by worker.
2) Analyzer produces points + directed links.
3) Node binding maps AI indices to live dot IDs.
4) setTopology(...) is called with AI links.
5) Springs are derived and physics links rebuilt.

Code paths:
- Analyzer prompt + schema: src/ai/paperAnalyzer.ts
- Apply analysis + links: src/document/nodeBinding.ts
- Mutation seam: src/graph/topologyControl.ts

## 6. How AI Output is Structured
Analyzer returns:
- paper_title: string
- main_points: [{ index, title, explanation }]
- links: [{ from_index, to_index, type, weight, rationale }]

Indices map to live dots by stable ordering (sorted by dot id).

## 7. How to Change Edge Length (Important)
Visible edge length is controlled by:
- targetSpacing in src/physics/config.ts
- rest length policy in src/graph/physicsMappingPolicy/defaultPolicy.ts

Note: linkRestLength does NOT change XPBD edge length right now.

## 8. Common Gotchas
- Self loops are dropped.
- Missing endpoints are dropped.
- Parallel links are deduped (strongest wins).
- Always pass a ForceConfig to setTopology to keep rest lengths consistent.

## 9. Debug Tips
- Use console: window.__topology.dump()
- Watch logs: [AI] Applied X analysis points, [AI] Applied Y directed links
- Check policy: window.__topology.physicsPolicyDump()
