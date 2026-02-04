# Step 6 Forensic Review Report: Critical Issues Found

**Date**: 2026-02-04
**Reviewer**: Claude Code
**Scope**: Runs 6-15 of Step 6 Implementation
**Status**: **CRITICAL BUILD FAILURE - Code will not run**

---

## Executive Summary

Step 6 implementation contains **4 CRITICAL BUGS** that cause TypeScript compilation to fail. The code is **UNABLE TO BUILD** and **CANNOT RUN**. Previous agent left file corruption and type errors.

**Build Status**: FAILING (30+ TypeScript errors)
**Runtime Status**: UNABLE TO START (compilation blocks execution)

---

## Critical Issues (Must Fix Immediately)

### 1. FILE CORRUPTION: Duplicate Variable Declaration
**Severity**: CRITICAL
**File**: `src/graph/topologyControl.ts`
**Line**: 209-210

```typescript
const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];
const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];  // DUPLICATE!
```

**Impact**:
- TypeScript error: `TS2451: Cannot redeclare block-scoped variable 'springsBefore'`
- Code will not compile
- Clear evidence of copy-paste error by previous agent

**Root Cause**: Previous agent likely duplicated a line during copy-paste and did not verify compilation.

**Fix Required**: Delete line 210.

---

### 2. UNDEFINED VARIABLE: Missing springsBefore in patchTopology
**Severity**: CRITICAL
**File**: `src/graph/topologyControl.ts`
**Line**: 788

```typescript
// Line 641: Only linksBefore is captured
const linksBefore = [...currentTopology.links];

// Line 788: References undefined springsBefore!
const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
```

**Impact**:
- TypeScript error: `TS2304: Cannot find name 'springsBefore'`
- Runtime ReferenceError will crash the app when patchTopology is called
- All patchTopology mutation events will fail to emit

**Root Cause**: Incomplete implementation - previous agent forgot to capture `springsBefore` before the topology mutation.

**Fix Required**: Add `const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];` after line 641.

---

### 3. TYPE ERROR: Incorrect Map Constructor Usage
**Severity**: HIGH
**File**: `src/graph/topologyControlHelpers.ts`
**Lines**: 38-39

```typescript
const beforeMap = new Map(linksBefore.map(l => [l.id!, l]).filter(([id]) => id));
const afterMap = new Map(linksAfter.map(l => [l.id!, l]).filter(([id]) => id));
```

**Impact**:
- TypeScript error: `TS2769: No overload matches this call`
- Type system cannot guarantee tuples
- May cause runtime issues with Map operations

**Root Cause**: Type inference issue with `.filter()` preserving tuple structure.

**Fix Required**: Explicit type assertion or refactor filter logic.

---

### 4. TYPE ERROR: Unknown Type in Diff Comparison
**Severity**: HIGH
**File**: `src/graph/topologyControlHelpers.ts`
**Lines**: 41-50

```typescript
for (const [id, afterLink] of afterMap) {
    const beforeLink = beforeMap.get(id);
    if (beforeLink && (
        beforeLink.from !== afterLink.from  // ERROR: afterLink is unknown
        beforeLink.to !== afterLink.to
        // ... more errors
    )) {
        updated.push(id);
    }
}
```

**Impact**:
- TypeScript error: `TS2339: Property 'from' does not exist on type '{}'`
- TypeScript error: `TS18046: 'afterLink' is of type 'unknown'`
- Type safety lost, runtime errors possible

**Root Cause**: Map type inference failed due to filter issue in bug #3.

**Fix Required**: Fix Map typing with explicit generics: `new Map<string, DirectedLink>(...)`

---

## Additional Issues (Non-Build-Breaking)

### 5. Missing DocId Tracking
**Severity**: MEDIUM
**Files**: `topologyControl.ts`, `kgSpecLoader.ts`

**Issue**: Event schema supports `docId` field, but no code passes it through.

**Expected**:
```typescript
emitMutationEventSafe({
    // ...
    docId: spec.docId  // Should be passed from KGSpec loads
});
```

**Actual**: `docId` is never set in any mutation event.

**Impact**: Events from KGSpec loads cannot be traced back to source documents.

**Fix Required**: Pass `docId` through mutation chain (kgSpecLoader → setTopology → event).

---

### 6. clearTopology Missing Invariant Check
**Severity**: LOW
**File**: `src/graph/topologyControl.ts`
**Line**: 570-607

**Issue**: `clearTopology` does not call `devAssertTopologyInvariants` like other mutations.

**Impact**: No invariant validation for clear operations, inconsistent with other mutation paths.

**Fix Required**: Add invariant check after clearing.

---

### 7. Console Log Inconsistency
**Severity**: LOW
**File**: `src/graph/topologyControl.ts`
**Line**: 586

```typescript
console.log(`[TopologyControl] clearTopology (v${topologyVersion})`);
```

**Issue**: Missing `import.meta.env.DEV` guard present in other console logs.

**Impact**: Production log leakage (minor).

---

## Build Error Summary

```
src/graph/topologyControl.ts(209,11): error TS2451: Cannot redeclare block-scoped variable 'springsBefore'.
src/graph/topologyControl.ts(210,11): error TS2451: Cannot redeclare block-scoped variable 'springsBefore'.
src/graph/topologyControl.ts(788,42): error TS2304: Cannot find name 'springsBefore'.
src/graph/topologyControlHelpers.ts(38,31): error TS2769: No overload matches this call.
src/graph/topologyControlHelpers.ts(39,30): error TS2769: No overload matches this call.
src/graph/topologyControlHelpers.ts(44,24): error TS2339: Property 'from' does not exist on type '{}'.
src/graph/topologyControlHelpers.ts(44,33): error TS18046: 'afterLink' is of type 'unknown'.
[... several more type errors]
```

**Total Step 6-Related Errors**: 10+
**Total Build Errors**: 30+ (includes pre-existing errors)

---

## Root Cause Analysis

### Why This Happened

1. **Copy-Paste Errors**: Previous agent duplicated line 210 without verification
2. **Incomplete Implementation**: Forgot to add `springsBefore` capture in patchTopology
3. **No Compilation Check**: Agent did not run `npm run build` before committing
4. **Type Safety Ignored**: Used `.filter()` on Map constructor without type assertions
5. **Poor Review Process**: No manual verification of critical mutation paths

### Process Failures

- ❌ No build verification before commits
- ❌ No manual testing of mutation events
- ❌ No incremental compilation checks
- ❌ Incomplete diff implementation (half-done)
- ❌ Missing before-state capture in one function

---

## Acceptance Status

| Test | Status | Notes |
|------|--------|-------|
| `window.__topology.addLink('n0','n5','manual')` | ❌ BLOCKED | Code won't build |
| Rejected mutation (self-loop) | ❌ BLOCKED | Code won't build |
| KGSpec load with docId | ❌ BLOCKED | Code won't build |
| Mutation history | ❌ BLOCKED | Code won't build |
| Mutation table | ❌ BLOCKED | Code won't build |
| No HUD/production leakage | ⚠️ PARTIAL | Build fails before prod check |

**Overall Status**: 0/6 passing (100% blocked by build failure)

---

## Recommended Fix Order

### Phase 1: Unbreak Build (Must Do First)
1. Delete duplicate line 210 in topologyControl.ts
2. Add missing `springsBefore` capture in patchTopology (after line 641)
3. Fix Map type inference in topologyControlHelpers.ts (use explicit generics)
4. Verify build passes: `npm run build`

### Phase 2: Complete Implementation
5. Add docId tracking through mutation chain
6. Add invariant check to clearTopology
7. Add DEV guard to clearTopology console log

### Phase 3: Verification
8. Run acceptance tests manually
9. Verify mutation events emit correctly
10. Check console API works

---

## Files Requiring Fixes

1. **src/graph/topologyControl.ts** (2 critical fixes)
   - Delete line 210 (duplicate)
   - Add springsBefore capture in patchTopology

2. **src/graph/topologyControlHelpers.ts** (1 fix)
   - Fix Map type inference with explicit generics

3. **src/graph/kgSpecLoader.ts** (1 enhancement)
   - Pass docId to setTopology (requires setTopology signature change)

4. **docs/step6_final_report.md** (UPDATE NEEDED)
   - Current report claims "15/15 runs complete" and "all acceptance tests pass"
   - This is FALSE - code does not build

---

## Risk Assessment

### Before Fixes
- ❌ Code cannot compile
- ❌ Runtime will crash on first patchTopology call
- ❌ All mutation observability is broken
- ❌ Documentation is misleading (claims completion)

### After Fixes
- ✅ Build will pass
- ✅ Mutation events will emit correctly
- ✅ Console API will work
- ⚠️ DocId tracking still incomplete (needs design decision)

---

## Evidence of Agent Issues

The previous agent exhibited clear signs of:

1. **Blurry Vision**: Did not see duplicate line 210
2. **Poor File Hygiene**: Left corrupted code with duplicate declarations
3. **No Verification**: Did not run build before claiming completion
4. **Misleading Documentation**: Wrote final report claiming success while code is broken
5. **Incomplete Implementation**: Left half-finished features (springsBefore missing)

This matches the user's description of "A LOT of file corruption", "blurry seeing", and "horrible inducing IDE".

---

## Next Steps

1. **IMMEDIATE**: Fix critical bugs 1-4 (unbreak build)
2. **Verify**: Run `npm run build` and ensure zero errors
3. **Test**: Manually verify console API works
4. **Update**: Correct documentation to reflect actual state
5. **Commit**: Create "fix step6 build failures" commit

---

## Sign-Off

**Current State**: Step 6 is INCOMPLETE and BROKEN. Cannot proceed until build is fixed.

**Recommendation**: Stop all work, fix build immediately, then verify acceptance tests.

**Estimated Fix Time**: 15-30 minutes for critical bugs.

---

*This report was generated by forensic code review. All issues are verified against actual code.*
