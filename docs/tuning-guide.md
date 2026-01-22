# Tuning Guide: Making the Physics Feel Subconsciously Good

This short guide is meant for **human tuning** after the refactor. The goal is to create a motion feel that is **calm, readable, and subtly alive**, without jitter or chaos.

## 1) Always tune in this order
1. **Stability first** (no explosions, no overlaps).  
2. **Shape next** (spacing, angles, hub freedom).  
3. **Motion feel last** (damping, spin, drift).

This keeps you from “fixing” motion by breaking structure.

## 2) Use one knob at a time
Every knob should move exactly one metric. If a change doesn’t clearly shift a single graph (spacing, angle, velocity), something is overlapping or in the wrong channel.

## 3) Watch these signals (not just the screen)
- **Average spacing violations** (min distance hits per frame).  
- **Average angle violations** (below soft threshold).  
- **Velocity energy curve** (should decay smoothly, no sudden cliffs).  
- **Safety clamp rate** (should be rare, not constant).

If one signal spikes, fix the owner pass for that behavior.

## 4) “Feels good” checklist
- Motion is smooth and continuous (no stutter).
- Nodes don’t snap or jitter when settling.
- Hubs feel heavier but still drift early.
- Dangling ends feel relaxed, not locked.
- Motion decays naturally (no sudden freeze).

## 5) Ground rules for safe tuning
- Change only one knob at a time.
- Use small steps (e.g., 5–10% adjustments).
- Keep a “golden seed” graph for A/B comparison.
- Never tune safety clamps to fix basic spacing.

## 6) If it feels wrong
Use the stats to find the dominant pass, then adjust only its knob. Avoid compensating with unrelated forces.
