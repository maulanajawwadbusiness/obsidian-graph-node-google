# AI Models Configuration

**Date**: 2026-01-29
**Status**: Consolidated

All AI model IDs are now centralized in a single configuration file.

## Configuration File
**Path**: `src/config/aiModels.ts`

```typescript
export const AI_MODELS = {
    CHAT: 'gpt-5-nano',     // FullChat & MiniChat
    PREFILL: 'gpt-5-nano',  // Suggestion Engine
    ANALYZER: 'gpt-5-nano', // Document Parsing
    REWRITER: 'gpt-5-nano', // Label Rewriter
} as const;
```

## How to Change Models
To update the model for any subsystem, simply edit `src/config/aiModels.ts`. The changes will propagate automatically to all relevant call sites.
