# Remote Failure Behavior for Saved Interfaces (Step 9)

Date: 2026-02-11

## Summary

Remote sync is now a best-effort mirror using a persistent per-identity outbox in AppShell.
Local state and localStorage remain immediate UX truth. Remote failures never block local operations.

## Where Queue Lives

- File: `src/screens/AppShell.tsx`
- Queue state: `remoteOutboxRef`
- Persistence key: `${SAVED_INTERFACES_KEY}_remote_outbox_${identityKey}`
  - `identityKey` is `guest` or `user:<id_...>`

## Outbox Item Shape

`RemoteOutboxItem` fields:
- `op`: `upsert` or `delete`
- `clientInterfaceId`
- `payload` (full `SavedInterfaceRecordV1` for upsert)
- `attempt`
- `nextRetryAt`
- `lastErrorCode`
- `createdAt`
- `identityKey`

## Queue Policy

1. Local commit first:
- AppShell commit paths update in-memory + localStorage immediately.
- Remote write is enqueued after local commit.

2. Retry behavior:
- Retryable: network/timeout, 5xx, 429.
- Exponential backoff with jitter, capped by `REMOTE_RETRY_MAX_MS`.

3. 401 behavior:
- Queue pauses for that identity window (`REMOTE_OUTBOX_PAUSE_401_MS`).
- Local behavior continues.

4. Non-retryable:
- 413 and other non-retryable errors are dropped from outbox.
- DEV log once with id/op/code only.

5. Restore safety:
- Drain is blocked while restore read-path is active.
- No remote writes are sent during restore.

6. Identity isolation:
- Outbox is loaded/persisted per identity key.
- Identity switch reloads correct outbox and prevents cross-account apply.

## Processing Triggers

- enqueue event
- auth/login ready
- identity switch
- browser `online` event
- scheduled `setTimeout` for due `nextRetryAt`

## Logging Discipline

- logs only transitions and metadata:
  - enqueue
  - success
  - retry scheduled
  - 401 pause
  - non-retryable drop
- never logs payload content

## Must-Pass Test Matrix

1. Offline create/rename/delete:
- local updates immediately and persist reload
- outbox grows

2. Recovery online:
- outbox drains
- remote converges to local

3. Auth expired (401):
- outbox pauses
- local remains responsive
- resumes after auth recovery

4. Identity switch A/B:
- queue for A does not apply under B
- switching back loads and drains A queue

5. Restore safety:
- restore does not trigger remote sends while restore-active
