# Physics HUD Usage (Maulana Quick Guide)

## Open the HUD
1. Click **Debug** (top-left).
2. The **Physics HUD** section is at the top of the panel.

## Read the Metrics
- **Nodes / Links**: Current dot count and link count.
- **FPS**: Smoothed frame rate.
- **Degrade**: Current degrade level + % time degraded (last 5s).
- **Settle**: State + time since last state change.
- **JitterAvg (1s)**: Average per-dot correction over the last second.
- **PBD Corr/frame**: Total correction magnitude per frame.
- **Conflict% (5s)**: % of frames where correction opposed velocity.
- **Energy Proxy**: Average v² (velocity energy proxy).

## Run Presets
Use the preset buttons to spawn fixed-seed setups:
- **N=5 / 20 / 60 / 250 / 500** (each uses a deterministic seed).

## Scenarios
- **Settle Test**: Spawns the current N with fixed seed. Wait until settle state reaches **sleep**, then hit **Record**.
- **Drag Test**: Highlights a dot. Drag it for ~2 seconds, release, then hit **Record**.

## Record Results
- **Record** stores the current HUD snapshot into the scoreboard table.
- Ratios are automatically shown versus the **N=5** baseline.

## Notes
- The panel captures pointer/wheel events, so testing stays isolated from the canvas unless you interact in the HUD.
