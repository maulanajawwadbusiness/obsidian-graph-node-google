## Future TODOs

1. Refer to `docs/todo_flat_blue_fix_8_runs.md` as the very first task to pick up.
2. Add a `"how to think" brain` system prompt / string system that reads the topology API so the AI can wire in sharp result understanding.
3. Implement a 10% expand-at-launch behavior: the map should start with 10% extra energy so it feels alive instead of static.
7. Surface the document viewer search UI so users can launch the search feature already wired under the hood.
8. Improve node hover highlight rendering: fix color jumps, overly dark fades, and invisible edges so highlights remain sharp.
18. Let users request a new analysis via a centered chat screen; after each request, store the analysis result and generated map.
19. Add a share flow that saves map state and history so users can share their work later.
20. Prioritize a visceral, nerve-and-bone user experience - if the user does not feel it, it is not done.

## XPBD Consistency Fixes (Rest Length + Stiffness)

1. Fix XPBD edge rest-length source mismatch:
   - Current gap: `src/physics/engine/engineTickXPBD.ts` builds constraint `restLen` from current spawn distance (`dist`) instead of policy/per-link rest length.
   - Target behavior: use derived per-link rest length (`link.length` or spring rest length from mapping policy) as the XPBD constraint rest length source.
   - Acceptance: changing rest-length policy/knobs visibly changes XPBD edge length in runtime.

2. Fix XPBD stiffness/compliance parity with mapping policy:
   - Current gap: XPBD uses global `engine.config.xpbdLinkCompliance` for all constraints and does not consume per-link compliance from mapping (`src/graph/springToPhysics.ts` stores `(link as any).compliance` but solver path ignores it).
   - Also review solver asymmetry and caps that can mask stiffness intent:
     - asymmetric weights in solver (`wA=1.0`, `wB=5.0`) in `src/physics/engine/engineTickXPBD.ts`
     - per-constraint correction cap (`xpbdMaxCorrPerConstraintPx`)
   - Target behavior: per-link compliance/stiffness from mapping policy should drive XPBD stiffness consistently and predictably.
   - Acceptance: stronger/softer link types from mapping policy produce expected relative rigidity in XPBD without hidden overrides.
## Welcome2 Typing Visual Stability (Chars Phase In/Out)

9. Re-test with DPR changes and zoom levels (100%, 125%, 150%, 175%) to catch anti-alias shimmer and glyph edge crawling.

## AppShell Hook-Order Hardening

1. Refactor `src/screens/AppShell.tsx` so every React hook (`useState`, `useRef`, `useMemo`, `useCallback`, `useEffect`) is declared before any conditional return path.
2. Move screen-gate render exits (for example the `welcome1` font gate blank screen) below the full hook declaration zone to prevent future hook-order regressions.
3. Add a local code comment near the first early-return gate stating that no new hooks may be added below conditional returns.
4. Validate with onboarding flow replay (`welcome1 -> welcome2 -> prompt`) and confirm no `Rendered more hooks than during the previous render` runtime error.
