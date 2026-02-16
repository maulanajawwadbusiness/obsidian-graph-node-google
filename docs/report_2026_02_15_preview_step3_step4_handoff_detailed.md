# Detailed Handoff Report: EnterPrompt Preview Step 3 + Step 4 Bedrock

Date: 2026-02-15
Branch context: `wire-preview-mount-graph` lineage (current head includes additional gate commits)
Purpose: future agent resume document with exact state of sample preview data hardening and runtime lease self-enforcement.

## 1. Executive Summary

Two major workstreams are now in place:

1. Step 3 hardening (dev-export to canonical restore path, fail-closed)
- Preview now loads sample payload through strict multi-stage validation.
- Any validation failure blocks runtime mount and shows explicit error UI.
- Silent empty-topology coercion is removed from strict default path.

2. Step 4 lifecycle safety bug fix (no zombie preview runtime after lease loss)
- Lease now exposes snapshot + subscription + token-active checks.
- Preview subscribes and self-unmounts immediately if token becomes inactive.
- Reacquire is conservative and epoch-gated (no polling loops).
- Graph boundary has defensive reacquire behavior.

## 2. Current Behavior Snapshot

### 2.1 Sample preview mount behavior
- Location: `src/components/SampleGraphPreview.tsx`
- Mount conditions:
  1. Lease state must be `allowed`
  2. Portal root must exist
  3. Sample pipeline result must be `ok`
- If any condition fails, graph runtime is not mounted.

### 2.2 Sample data pipeline (strict)
Current preview pipeline is:
1. dynamic import sample payload
2. strict dev-export parse
3. strict adapter to `SavedInterfaceRecordV1`
4. preview-only saved-record parse wrapper
5. semantic validator
6. mount `GraphPhysicsPlayground` with `pendingLoadInterface`

Primary files:
- `src/components/SampleGraphPreview.tsx`
- `src/lib/devExport/parseDevInterfaceExportStrict.ts`
- `src/lib/devExport/devExportToSavedInterfaceRecord.ts`
- `src/lib/devExport/parseSavedInterfaceRecordForPreview.ts`
- `src/lib/preview/validateSampleGraphSemantic.ts`
- `src/lib/validation/result.ts`
- `src/lib/validation/errors.ts`

### 2.3 Lease self-enforcement behavior
Primary file: `src/runtime/graphRuntimeLease.ts`

Added APIs:
- `getGraphRuntimeLeaseSnapshot()`
- `subscribeGraphRuntimeLease(...)`
- `isGraphRuntimeLeaseTokenActive(token)`
- `assertActiveLeaseOwner(owner, token?)` (dev only)
- `getGraphRuntimeLeaseDebugSnapshot()`

Preview owner:
- `prompt-preview` in `src/components/SampleGraphPreview.tsx`

Graph owner:
- `graph-screen` via `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- mounted in `src/screens/appshell/render/renderScreenContent.tsx`

Enforcement:
- When preview token becomes inactive after graph preempt, preview sets paused state and unmounts runtime immediately.
- Cleanup now releases current token ref (not stale captured token), improving StrictMode safety.

## 3. Key Commits (Step 3 + Step 4)

### Step 3 hardening
- `a3920cc` feat(preview): add explicit validation result flow for sample restore (r1-r3)
- `1c072a9` fix(preview): make dev-export adapter strict + stronger structural gating (r4-r6)
- `d7bc85f` feat(preview): add semantic validation so bad samples fail explicitly (r7-r9)
- `e15a7e4` chore(preview): harden empty-graph prevention + clearer error UX (r10-r12)
- `ba599d5` docs(preview): finalize strict canonical sample restore validation (r13-r15)

### Step 4 lease-loss bug fix
- `872f770` feat(runtime): add lease snapshot + subscription for self-enforcing runtime ownership (r1-r3)
- `5ad3d19` fix(preview): self-unmount on lease loss + safe reacquire on lease changes (r4-r6)
- `e426d1d` docs(runtime): document self-enforcing lease + verification checklist (r7-r9)
- `0387443` chore(runtime): add invariant self-check for graph runtime lease (r10)

## 4. Reports Generated During This Work

### Step 3 reports
- `docs/report_2026_02_15_step3_hardening_r1.md`
- `docs/report_2026_02_15_step3_hardening_r2.md`
- `docs/report_2026_02_15_step3_hardening_r3.md`
- `docs/report_2026_02_15_step3_hardening_r4.md`
- `docs/report_2026_02_15_step3_hardening_r5.md`
- `docs/report_2026_02_15_step3_hardening_r6.md`
- `docs/report_2026_02_15_step3_hardening_r7.md`
- `docs/report_2026_02_15_step3_hardening_r8.md`
- `docs/report_2026_02_15_step3_hardening_r9.md`
- `docs/report_2026_02_15_step3_hardening_r10.md`
- `docs/report_2026_02_15_step3_hardening_r11.md`
- `docs/report_2026_02_15_step3_hardening_r12.md`
- `docs/report_2026_02_15_step3_hardening_r13.md`
- `docs/report_2026_02_15_step3_hardening_r14.md`
- `docs/report_2026_02_15_step3_hardening_r15.md`

### Step 4 reports
- `docs/report_2026_02_15_step4_lease_loss_bug_r1.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r2.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r3.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r4.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r5.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r6.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r7.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r8.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r9.md`
- `docs/report_2026_02_15_step4_lease_loss_bug_r10.md`

## 5. Contracts That Must Not Regress

### 5.1 Preview restore path contract
- Preview must continue using canonical restore path (`pendingLoadInterface`), not a preview-only graph format.

### 5.2 Fail-closed validation contract
- Invalid sample payload must never mount `GraphPhysicsPlayground`.
- Error UI must remain explicit and coded.

### 5.3 Lease ownership contract
- Only one active runtime lease at a time.
- `graph-screen` preempts `prompt-preview`.
- Any owner losing active token must stop using runtime immediately.

### 5.4 Graph-screen non-blocking contract
- Graph boundary should remain permissive and recover by reacquiring if needed.

## 6. Known Deferred Items (Not Done Here)

Still intentionally deferred:
1. onboarding wheel-guard target gating for preview area
2. graph render-loop cleanup leaks
3. topology singleton refactor
4. broader perf tuning outside current scope

## 7. Current Worktree Context

At time of writing, unrelated local changes visible:
- modified: `src/screens/AppShell.tsx`
- untracked: `docs/merged_report.md`

These are not part of this handoff scope unless explicitly requested.

## 8. Build Verification Status

- `npm run build` was executed after each run in step 3 and step 4.
- Builds passed throughout, with recurring known Vite warnings:
  1. static + dynamic import coexistence around `GraphPhysicsPlayground`
  2. large chunk size warnings

## 9. Quick Resume Checklist (Next Agent)

1. Read:
- `docs/system.md` (sections on preview hardening and runtime lease)
- this report

2. Inspect key code seams:
- `src/components/SampleGraphPreview.tsx`
- `src/runtime/graphRuntimeLease.ts`
- `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`

3. If continuing lease work, validate first:
- preempt path from prompt to graph
- preview token loss unmount behavior
- no stale-token release regressions

4. If continuing preview data work, preserve:
- strict parse -> adapter -> parse wrapper -> semantic validator order
- fail-closed mount gate behavior

## 10. Final State Statement

As of this handoff, preview sample loading and lifecycle ownership are both hardened to bedrock-level behavior for current scope:
- invalid data cannot silently mount runtime
- preempted preview cannot silently keep running
- ownership and state are observable via lease snapshot/subscription and debug counters