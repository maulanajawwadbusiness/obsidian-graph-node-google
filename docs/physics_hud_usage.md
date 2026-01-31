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

## Feel Markers
Enable in the Debug panel (dev-only toggles):
- **Show Rest Markers**: Small cyan dot below each dot that is truly at rest. If a dot looks still but is jittering, the marker turns amber.
- **Show Conflict Markers**: Thin pink halo around dots where PBD correction is fighting velocity (higher intensity = more conflict).
- **Marker Intensity**: Multiplies marker visibility when testing in bright themes.

### How to Use (N=5/20/60)
1. Run **Settle Test** and wait for settle state = **sleep**.
2. Turn on **Show Rest Markers** to verify cyan dots stay steady. Any amber signals micro-jitter.
3. Run **Drag Test** and turn on **Show Conflict Markers**. Watch for hot halos around the dragged cluster and any unexpected hotspots far away.

## Notes
- The panel captures pointer/wheel events, so testing stays isolated from the canvas unless you interact in the HUD.
