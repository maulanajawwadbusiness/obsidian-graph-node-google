# FORENSIC REPORT: XPBD Damping Presets No Effect

**Date**: 2026-02-02  
**Status**: INSTRUMENTED (Ready for diagnosis)

---

## 1. Symptoms
User reports that clicking XPBD damping presets (Snappy 0.12 / Balanced 0.20 / Smooth 0.32) results in **0 change on screen**. 

Possible causes:
1.  **UI Wiring**: Buttons don't actually update `engine.config`.
2.  **Config Propagation**: `engine.config` updates, but tick sees a stale copy.
3.  **Sim Path**: System is silently running Legacy or Hybrid mode (ignoring XPBD params).
4.  **Parameter Isolation**: `xpbdDamping` value is clamped, overwritten, or ignored inside the tick.
5.  **Physics Masking**: Other forces (velocity cap, drag, repulsion) are dominating behavior, masking the damping change.

---

## 2. Execution Path & Truth Chain

### UI -> State -> Config
1.  **UI**: `GraphPhysicsPlayground.tsx` (Buttons) -> calls `engine.applyXpbdDampingPreset()`
2.  **Engine**: `engine.ts` -> calls `this.updateConfig({ xpbdDamping })`
3.  **Topology**: `engineTopology.ts` -> merges `engine.config = { ...engine.config, ...newConfig }`

### Config -> Tick -> Physics
4.  **Tick Entry**: `engineTickXPBD.ts` -> READS `engine.config.xpbdDamping`
5.  **Damping Selection**: `raw = config.xpbdDamping ?? DEFAULT`
6.  **Application**: Passes `effectiveDamping` to `integrateNodes`
7.  **Integration**: `integration.ts` calls `applyDamping(v *= exp(...))`

If the chain is unbroken, velocity MUST decay differently.

---

## 3. Evidence Collection (Logs Added)

I have added filtered forensic logs to the codebase. Here is how to interpret them:

### A. Check UI & Config Merge
Open console. Click a preset button.
**Look for**:
```
[Forensic] applyXpbdDampingPreset called with: SNAPPY
[Forensic] Setting xpbdDamping to: 0.12
[Forensic] updateEngineConfig merging xpbdDamping: 0.12, previous: 0.20
```
*If missing*: UI or Engine wiring is broken.

### B. Check Tick is XPBD & Config is Live
Watch the console (logs every ~1 sec / 60 frames).
**Look for**:
```
[Forensic Frame 1234] XPBD Tick Running. Telemetry: {
  source: 'CONFIG',       <-- MUST say CONFIG (not DEFAULT)
  raw: 0.12,              <-- MUST match preset
  effective: 0.12,
  frameFactor: '0.9904'   <-- Decay multiplier (differs by preset)
}
```
*If `source: DEFAULT`*: Config update failed or property lost.
*If `raw` matches but `effective` doesn't*: Safety clamp is interfering.
*If log missing*: XPBD Tick is NOT running (Legacy mode active?).

### C. Verify Damping Math
Compare `frameFactor` (per-frame decay multiplier):
- **Snappy (0.12)**: `~0.9904` (1.0% decay/frame)
- **Balanced (0.20)**: `~0.9841` (1.6% decay/frame)
- **Smooth (0.32)**: `~0.9747` (2.5% decay/frame)

If these values change in the log, **physics IS changing**. If you don't see it, it's a perception/tuning issue (range too narrow).

---

## 4. Root Cause Suspects (Truth Table)

| Symptom in Log | Root Cause | Fix |
|----------------|------------|-----|
| No `[Forensic]` config logs | UI button not wired | Check `applyXpbdDampingPreset` |
| Tick Log shows `source: DEFAULT` | Config merge failed | Check `updateEngineConfig` |
| Tick Log shows `raw: 0.12` but `frameFactor` constant | Math error | Check `engineTickXPBD` math |
| All Logs Correct, but feel is same | **Range too narrow** | Widen presets (e.g. 0.05 - 0.50) |

---

## 5. Next Steps

1.  **Run the app** and open Developer Console.
2.  **Click "Snappy"**, then **"Smooth"**.
3.  **Capture the logs**.
4.  **Diagnosis**:
    *   If logs show correct values flowing: The code is correct, the *values* are just too subtle. **Action**: Widen the preset range.
    *   If logs fail to update: We found the bug in the chain (A or B). **Action**: Fix wiring.

**(Self-Correction logic applied during analysis to ensure `reconcileAfterXPBDConstraints` does not negate damping via velocity overwrite. It uses `node.prevX += dx`, preserving velocity momentum.)**
