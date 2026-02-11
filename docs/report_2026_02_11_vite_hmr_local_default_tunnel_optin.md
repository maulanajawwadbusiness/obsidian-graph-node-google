# Report 2026-02-11: Vite HMR Local Default and Tunnel Opt-In

## Summary
Fixed local Vite hot reload breakage by removing forced global tunnel HMR settings from default dev behavior.

New behavior:
- Local dev defaults to normal Vite HMR websocket behavior.
- Tunnel HMR (`wss` on port `443`) is now opt-in via env flag.

## Problem
Local development was forced to use:
- `server.hmr.protocol = "wss"`
- `server.hmr.clientPort = 443`

This made local browser clients attempt websocket connection to port `443` even when the app was served from `http://localhost:5173`, which can block HMR updates and require manual page refresh.

## Changes
File changed:
- `vite.config.ts`

Implementation:
1. Switched config to function form and loaded env via `loadEnv`.
2. Added mode flag:
   - `VITE_DEV_TUNNEL_HMR=1` enables tunnel HMR profile.
3. Default profile no longer forces `server.hmr` protocol/port.
4. Kept tunnel host allowlist support:
   - `allowedHosts: ['.trycloudflare.com']`

## Contract
Default (no flag):
- Local HMR uses Vite defaults.
- No forced `wss:443`.

Tunnel mode:
- Set `VITE_DEV_TUNNEL_HMR=1` before running dev server.
- HMR uses `wss` with client port `443`.

## Verification
Recommended verification runbook:
1. Local mode:
   - Run `npm run dev`.
   - Open browser dev console and confirm Vite websocket connects without `wss:443` forcing.
   - Edit a source file and confirm hot update applies without manual reload.
2. Tunnel mode:
   - Run with `VITE_DEV_TUNNEL_HMR=1`.
   - Expose dev server via tunnel.
   - Confirm remote browser receives HMR updates.

## Risk
Low risk.
- Scope is limited to Vite dev server HMR behavior.
- No production build/runtime behavior change.
- No backend/auth/database behavior changed.
