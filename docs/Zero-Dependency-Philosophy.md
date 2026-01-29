# The "Zero-Dependency" Philosophy

# Zero-Dependency Architecture

**Strategy**: Minimal Dependency Surface Area
**Objective**: Maximize Long-Term Velocity & System Stability

## 1. Executive Summary
Arnvoid prioritizes a "Zero-Dependency" architecture for its core logic. This is a strategic engineering decision designed to maintain high velocity, ensure immunity to ecosystem churn, and deliver native-tier performance. We favor standard Web APIs (`fetch`, `TextDecoder`) over third-party abstractions.

## 2. Strategic Advantages

### A. Ecosystem Immunity (Anti-Fragility)
Modern JavaScript ecosystems are volatile. High-level SDKs introduce "supply chain risks" where upstream breaking changes (e.g., v3 `→` v4 migrations) force unplanned maintenance cycles.
*   **The Advantage**: By building on immutable Web Standards, our core networking and AI logic is timeless. It requires zero maintenance when libraries update, allowing focus to remain on product features.

### B. Architectural Control
Third-party libraries often obscure critical implementation details behind "black box" abstractions.
*   **The Advantage**: Owning the implementation (e.g., `openaiClient.ts`) grants surgical control over data parsing. When APIs ship non-standard beta responses—such as complex nested JSON in `v1/responses`—we adapt immediately without waiting for upstream SDK patches.

### C. Performance & Payload Hygiene
Abstraction layers come with a cost: bundle size and initialization latency.
*   **The Advantage**: Our AI layer ships `<15KB` of highly optimized logic. This results in instant application load times and a "native" responsiveness that heavy dependency trees cannot match.

## 3. Implementation Standards

| Component | Standard | Rationale |
| :--- | :--- | :--- |
| **Networking** | Native `fetch` | Zero overhead, universal support, granular control over headers/signals. |
| **Streaming** | `TextDecoder` Loop | Direct byte-stream control allowing custom buffering strategies. |
| **State** | React Context | Sufficient for 95% of UI needs; avoids boilerplate of external state libraries. |

## 4. Exception Trace
Dependencies are acceptable effectively *only* when the ROI is undeniable:
1.  **Standardization**: When a library is the de-facto standard for a complex format (e.g., `pdf.js` for PDF rendering).
2.  **Computational Complexity**: High-performance physics or mathematics (e.g., `graphology`, `force-graph`) where re-implementation carries high risk.

**Engineering Heuristic**: If the logic can be implemented robustly in under 100 lines of standard code, do not introduce a dependency.
