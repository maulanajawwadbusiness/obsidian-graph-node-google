# Provider Routing Test Results (DB Simulation)

Date: 2026-02-06
Scope: verify provider routing flips (free cohort + cap + pool exhaustion)

## What Was Tested
- Created a cohort user by inserting test users until one landed in today’s cohort.
- Simulated free-user usage crossing the 8,000 token cap.
- Simulated pool exhaustion by setting remaining_tokens to 0.

## Key Results
- Cohort user found: user_id 1600 (created from test users).
- Used tokens updated from 7,990 to 8,010.
- Pool remaining decreased from 750,000 to 749,980 after simulated spend.
- Decision logic results:
  - With used_tokens >= 8,000 and pool remaining > 0 => provider=openrouter (cap_exhausted).
  - With pool remaining = 0 => provider=openrouter (pool_exhausted).

## Notes
- These checks were done using direct DB updates and the policy decision logic.
- No real LLM requests were sent.
- Test users were inserted only to obtain a cohort user for today.

## Cleanup
- Test users were deleted after verification (google_sub prefix `test-cohort-`).
