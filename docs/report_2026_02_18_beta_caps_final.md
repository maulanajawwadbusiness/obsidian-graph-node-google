# Run 8 Final Verification - Beta Caps Bedrock (2026-02-18)

## Scope
Final verification and ops documentation pass for beta caps delivery.
No new feature logic added in this run.

## Verification Commands Executed
- Frontend build: `npm run build` (repo root) - PASS
- Backend build: `npm run build` (from `src/server`) - PASS
- Backend contracts: `npm run test:contracts` (from `src/server`) - PASS

## Toggle Matrix (Authoritative Behavior)
| Backend `BETA_CAPS_MODE` | Frontend `VITE_BETA_CAPS_MODE` | Expected Behavior |
| --- | --- | --- |
| 0/off | 0/off | No caps enforcement. Prompt uses pre-caps behavior. |
| 1/on | 0/off | Server enforces caps (authoritative). Client does not preflight balloon/disable UX. |
| 0/off | 1/on | Client shows caps UX preflight only. Server does not enforce caps. |
| 1/on | 1/on | Full mode: client mirrors caps UX, server enforces caps with 429 guardrails. |

## Server Contracts Confirmed
- Daily usage endpoint:
  - `GET /api/beta/usage/today` (`requireAuth`)
  - Response includes: `caps_enabled`, `date_key`, `daily_limit`, `used_words`, `remaining_words`, `reset_note`
- LLM cap violation response:
  - HTTP `429`
  - `error.code` is one of:
    - `beta_cap_exceeded`
    - `beta_daily_exceeded`
  - Includes limit and usage metadata (`per_doc_limit`, `daily_limit`, `submitted_word_count`, `daily_used`, `daily_remaining`, `date_key`, `reset_note`)

## UX Contract Confirmed
- Per-doc over-limit message string is exact:
  - `Document is more than 7500 words`
- Prompt send is disabled when:
  - document words exceed 7500
  - daily beta limit is reached
  - upload parsing is pending or failed (fail-closed)

## Word Count Canonical Rule Confirmed
Server and client usage for caps follows:
- `text.trim().split(/\s+/).filter(Boolean).length`
- empty/whitespace-only input resolves to `0`

## Ops Docs Updated This Run
- `docs/system.md`
  - Added `Beta Caps Mode Toggle (Ops)` section
  - Added agent redeploy runbook with backend-first rollout and verification steps
- `AGENTS.md`
  - Added `BETA MODE REDEPLOY ORDER (NON-NEGOTIABLE)` guardrail

## Known Limitations (Intentional)
- Payment logic changes are out of scope in this run.
- Caps are toggle-gated and can be disabled by env-only rollback.
- Reset boundary is UTC day (`00:00 UTC`, `07:00 WIB`) by design.
