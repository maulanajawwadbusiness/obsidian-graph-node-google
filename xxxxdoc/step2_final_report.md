# KGSpec - Knowledge Graph Specification v1

**Version**: `kg/1`  
**Purpose**: Canonical format for parser/AI-generated knowledge graphs

---

## Overview

KGSpec is a versioned JSON format that represents semantic knowledge graphs. It separates the **knowledge layer** (concepts + relationships) from the **physics layer** (springs + forces).

### Key Principles
- **Directed meaning**: Links have semantic direction (`A causes B` ≠ `B causes A`)
- **Undirected springs**: Physics uses undirected springs (derived from directed links)
- **Validation first**: Invalid specs are rejected before topology mutation
- **Deterministic**: Same spec → same topology →same graph

---

## Spec Format

### Complete Structure
```json
{
  "specVersion": "kg/1",
  "nodes": [...],
  "links": [...],
  "namespace": "optional",
  "docId": "optional",
  "provenance": {
    "generator": "optional",
    "timestamp": "optional",
    "model": "optional"
  }
}
```

### Required Fields
- `specVersion`: Must be `"kg/1"`
- `nodes`: Array of node objects
- `links`: Array of link objects

---

## Node Format

```json
{
  "id": "unique-id",
  "label": "Human Readable Label",
  "kind": "concept",
  "source": {
    "docId": "doc-123",
    "page": 5,
   "section": "Introduction"
  },
  "payload": {...}
}
```

### Fields
| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | **Yes** | string | Unique identifier (within this spec) |
| `label` | No | string | Display name (defaults to id) |
| `kind` | No | string | Semantic type ('concept', 'person', 'event') |
| `source` | No | object | Provenance metadata |
| `payload` | No | object | Arbitrary data for future use |

---

## Link Format

```json
{
  "from": "node-a",
  "to": "node-b",
  "rel": "causes",
  "weight": 0.9,
  "directed": true,
  "meta": {...}
}
```

### Fields
| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `from` | **Yes** | string | Source node ID |
| `to` | **Yes** | string | Target node ID |
| `rel` | No | string | Relationship type ('causes', 'supports', 'contradicts') |
| `weight` | No | number | Strength (0-1, default 1.0) |
| `directed` | No | boolean | Directionality (default true) |
| `meta` | No | object | Arbitrary metadata |

---

## Validation Rules

### Errors (Spec Rejected)
1. ❌ Missing or invalid `specVersion`
2. ❌ Missing or invalid `nodes` array
3. ❌ Node without `id`
4. ❌ Duplicate node IDs
5. ❌ Missing or invalid `links` array
6. ❌ Link without `from` or `to`
7. ❌ **Self-loops** (`from === to`)
8. ❌ **Missing endpoints** (link references non-existent node)

### Warnings (Non-Fatal)
1. ⚠️ Link missing `rel` type
2. ⚠️ Weight outside [0, 1] range
3. ⚠️ Empty graph (no nodes)
4. ⚠️ No links in graph

---

## Directed vs Undirected

### Semantic Layer (Directed)
Knowledge relationships have meaning:
- `"Climate Change" → "Rising Seas"` (causes)
- `"Renewable Energy" → "Climate Change"` (mitigates)

Direction matters for semantic interpretation.

### Physics Layer (Undirected)
Springs are bidirectional forces:
- `Climate Change ←→ Rising Seas` (connected)
- `Renewable Energy ←→ Climate Change` (connected)

**Conversion**: `deriveSpringEdges()` creates undirected springs from directed links. Deduplicates A→B + B→A into one spring.

---

## Loading & Console Commands

### Dev Console (Dev Mode Only)
```javascript
// Load example
window.__kg.loadExample();

// Load custom spec
window.__kg.load({
  specVersion: 'kg/1',
  nodes: [...],
  links: [...]
});

// Load from JSON string
const jsonStr = '{"specVersion":"kg/1",...}';
window.__kg.loadJson(jsonStr);

// Validate without loading
window.__kg.validate(spec);

// Export current topology
const spec = window.__kg.dump();
```

### Programmatic API
```typescript
import { setTopologyFromKGSpec } from './graph/kgSpecLoader';

const success = setTopologyFromKGSpec(spec, {
  validate: true,        // Run validation first
  allowWarnings: true    // Accept even with warnings
});
```

---

## Common Mistakes

### ❌ Self-Loop
```json
{
  "from": "node-a",
  "to": "node-a",  // ← INVALID
  "rel": "relates"
}
```
**Fix**: Remove self-referential links.

### ❌ Missing Endpoint
```json
{
  "nodes": [{"id": "n1"}],
  "links": [{
    "from": "n1",
    "to": "n2",  // ← n2 doesn't exist
    "rel": "links"
  }]
}
```
**Fix**: Ensure all link endpoints reference existing nodes.

### ❌ Duplicate Node IDs
```json
{
  "nodes": [
    {"id": "concept1"},
    {"id": "concept1"}  // ← DUPLICATE
  ]
}
```
**Fix**: Make all node IDs unique.

### ❌ Wrong Version
```json
{
  "specVersion": "kg/2",  // ← Unsupported
  ...
}
```
**Fix**: Use `"kg/1"` for current version.

---

## Example

```json
{
  "specVersion": "kg/1",
  "docId": "climate-paper-001",
  "nodes": [
    {
      "id": "climate-change",
      "label": "Climate Change",
      "kind": "phenomenon"
    },
    {
      "id": "sea-rise",
      "label": "Rising Sea Levels",
      "kind": "consequence"
    },
    {
      "id": "renewables",
      "label": "Renewable Energy",
      "kind": "intervention"
    }
  ],
  "links": [
    {
      "from": "climate-change",
      "to": "sea-rise",
      "rel": "causes",
      "weight": 0.9
    },
    {
      "from": "renewables",
      "to": "climate-change",
      "rel": "mitigates",
      "weight": 0.7
    }
  ],
  "provenance": {
    "generator": "gpt-5.1",
    "timestamp": "2026-02-04T00:00:00Z"
  }
}
```

---

## Future Extensions

### Planned Features
- **Namespaces**: Avoid ID conflicts across documents
- **Link metadata enrichment**: Confidence scores, citations
- **Node clustering**: Group related concepts
- **Temporal links**: Time-based relationships

### Backwards Compatibility
Future versions (kg/2, etc.) will maintain backwards compatibility with kg/1 loaders where possible.

---

## Implementation Details

### Files
- `src/graph/kgSpec.ts` - Type definitions
- `src/graph/kgSpecValidation.ts` - Validation logic
- `src/graph/kgSpecLoader.ts` - Conversion + ingestion
- `src/graph/devKGHelpers.ts` - Console commands (dev-only)

### Integration
Parser/AI outputs KGSpec → `setTopologyFromKGSpec()` → Topology → `deriveSpringEdges()` → Physics

### Verification
All validation errors logged to console. Invalid specs never mutate current topology.
