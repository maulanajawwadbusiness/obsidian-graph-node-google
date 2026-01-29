# Docs Refresh After Physics Perf Hardening

This report summarizes updates to keep documentation aligned with current physics/perf behavior and handoff flow.

## docs/system.md
- Added tick scheduling doctrine: physics ticks decoupled from refresh rate with a target Hz and capped steps per frame.
- Documented adaptive degradation rules and perf modes (normal/stressed/emergency/fatal) plus safe-mode behavior when N/E exceed the envelope.
- Listed current perf telemetry and log tags used for debugging (tick ms, ticks/sec, N/E, mode flags).
- Clarified intended operating envelope for paper-essence graphs and what happens outside it.

## docs/handoff.md
- Confirmed mini-to-full payload schema and context priority ordering (handoff content first, activeDocument fallback).
- Added `suggestedPrompt` presence in `MiniChatContext` and clarified node label derivation from the selected node id.
- Noted the current handoff log tag and that perf throttles do not change the payload shape or ordering.

## AGENTS.md
- Updated onboarding doctrine with new perf rules (tick rate decoupling, adaptive gating, safe mode).
- Added an explicit instrumentation step before implementation in the workflow.
- Cleaned up critical warnings and ensured ASCII-only headings.
- Added a dedicated physics perf doctrine section so new agents find the rules immediately.
