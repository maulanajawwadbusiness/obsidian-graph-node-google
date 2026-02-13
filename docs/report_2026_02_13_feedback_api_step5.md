# Feedback API Endpoints Step 5 (Backend Only)

## Scope
- Backend routes only in `src/server/src/serverMonolith.ts`.
- No frontend wiring in this step.

## Admin env vars
- Primary: `ADMIN_EMAIL_ALLOWLIST`
- Fallback: `ADMIN_EMAILS`
- Format: comma-separated emails, trimmed + lowercased in server parser.

## Migration prerequisite
- Apply migration before calling feedback endpoints:
```powershell
cd src/server
npm run migrate up
```

## Endpoint contracts

### 1) POST `/api/feedback` (requireAuth)
- Body:
```json
{
  "category": "ux",
  "message": "The popup should remember scroll position.",
  "context": {
    "screen": "graph",
    "url": "https://beta.arnvoid.com"
  }
}
```
- Notes:
  - `message` required, max length enforced.
  - `category` optional, max length enforced.
  - `context` optional object, size-limited.
- Response:
```json
{ "ok": true, "id": 123 }
```

### 2) GET `/api/feedback` (requireAuth + admin-only)
- Query:
  - `limit` optional, default 50, clamped 1..200
  - `beforeId` optional positive integer
- Response:
```json
{
  "ok": true,
  "items": [
    {
      "id": 123,
      "userId": 9,
      "category": "ux",
      "message": "Example",
      "context": { "screen": "graph" },
      "status": "new",
      "createdAt": "2026-02-13T08:00:00.000Z"
    }
  ],
  "nextCursor": 122
}
```

### 3) POST `/api/feedback/update-status` (requireAuth + admin-only)
- Body:
```json
{
  "id": 123,
  "status": "triaged"
}
```
- Response:
```json
{ "ok": true, "updated": true }
```

## Curl recipes (cookie-session based)

### Submit feedback
```bash
curl -i -X POST "$API_BASE/api/feedback" \
  -H "Content-Type: application/json" \
  -b cookie.txt \
  -d '{"category":"ux","message":"Example feedback","context":{"screen":"graph"}}'
```

### Admin list feedback
```bash
curl -i "$API_BASE/api/feedback?limit=50&beforeId=123" \
  -b cookie.txt
```

### Admin update status
```bash
curl -i -X POST "$API_BASE/api/feedback/update-status" \
  -H "Content-Type: application/json" \
  -b cookie.txt \
  -d '{"id":123,"status":"done"}'
```

## Security/logging notes
- All feedback routes require `requireAuth`.
- Admin list/update are backend-gated via admin allowlist helper.
- Server logs metadata only (id, size, status, category), not full message/context payloads.
