---
name: backend-enterprise
description: designs industrial backend (db schema, auth, quotas, jobs, caching) with reliability gates and simple ops.
triggers:
  - "backend"
  - "database"
  - "1000 users"
  - "enterprise"
---

# backend-enterprise

## rule: correctness via contracts
- define data model + invariants first
- define failure modes (timeouts, retries, idempotency)
- define observability (logs/metrics/traces)
- define security (authz, rate limit)

## deliverables
- schema sketch
- api endpoints
- job queues/background work
- caching strategy
- perf budgets + load assumptions
- rollout plan

(no code unless asked)
