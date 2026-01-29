# The Zero-Dependency Doctrine

**Date**: 2026-01-29
**Status**: ACTIVE & BELOVED
**Philosophy**: "Ownership over Convenience"

## 1. The Core Tenet
In Arnvoid, we reject the default modern impulse to `npm install` for every problem. We prefer **Zero Dependencies** wherever possible. This is not just asceticism; it is a strategic engineering choice with three massive benefits.

## 2. The Three Pillars

### A. Immunity to "Code Rot"
*   **The Reality**: The JS ecosystem is volatile. Libraries break, APIs churn (v3 -> v4), and maintainers abandon projects.
*   **Our Advantage**: By building on standard Web APIs (`fetch`, `TextDecoder`, `AbortSignal`), our code is timeless. It does not break because a third-party author decided to change a class name. It works today, and it will work in 5 years.

### B. Surgical Precision & Control
*   **The Reality**: Libraries are "black boxes". When an edge case hits (like a nested `v1/responses` JSON shape), library users are helpless until a patch is released.
*   **Our Advantage**: We own the silicon. `openaiClient.ts` is 100% our code. When we need to handle a specific API quirk or a new beta event, we change *our* parser immediately. We are never blocked.

### C. Performance (The "Native" Feel)
*   **The Reality**: "Convenience" libraries often bring massive transitive dependencies (polyfills, file system wrappers) that bloat the bundle and slow down startup.
*   **Our Advantage**: Our AI layer is just a few kilobytes of logic. The application loads instantly and runs at 60fps because it isn't carrying dead weight.

## 3. The Implementation
*   **Networking**: Native `fetch`. No Axios.
*   **Streaming**: Native `TextDecoder` loop. No streaming libraries.
*   **State**: React Context/State. No Redux/Zustand (unless complexity strictly demands it).

## 4. When to Break The Vow
Dependencies are permitted ONLY when:
1.  The complexity of re-implementing is dangerous (e.g., Cryptography).
2.  The standard requires it (e.g., `pdf.js` for rendering PDF binaries).
3.  The value transaction is massive (e.g., a Physics engine like generic `force-graph`, though even then, we prefer to own the renderer).

**Default Stance**: "Can I write this myself in 50 lines of code? If yes, do not install."
