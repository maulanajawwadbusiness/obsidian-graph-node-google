# Report: Step 8 - Deploy Env, Model Defaults, CORS/Cookies (Prod Readiness)

Date: 2026-02-06
Scope: Verify env wiring, model defaults, and CORS/cookies behavior for production. No secrets included.

## A) Env Var Wiring (Cloud Run + Local)

### OpenAI key wiring
- Server reads OpenAI key via process.env.OPENAI_API_KEY in the LLM client.
- If missing, LLM client returns an error with code=unauthorized, which maps to HTTP 401 in endpoints.
Evidence: src/server/src/llm/llmClient.ts (getApiKey, generate* error model) and src/server/src/index.ts (mapLlmErrorToStatus).

Expected failure behavior (no key):
- HTTP 401
- JSON error: { ok:false, request_id, code:"unauthorized", error:"missing api key" }

### Database env vars
- DB connection uses INSTANCE_CONNECTION_NAME, DB_USER, DB_PASSWORD, DB_NAME.
Evidence: src/server/src/db.ts.

## B) Model Selection Defaults (Backend Owns Truth)

### Source of truth
- AI model allowlist uses AI_MODELS mapping.
Evidence: src/config/aiModels.ts.

### Policy chosen
- Strict policy: server ignores any client model override and always uses endpoint defaults.
- If a client sends a model not in allowlist, it returns 400 bad_request.
- If client sends a valid model, it is still ignored in favor of endpoint default.
Rationale: prevents accidental model drift and keeps server authoritative.

### Defaults enforced
- /api/llm/paper-analyze -> AI_MODELS.ANALYZER (gpt-5.2)
- /api/llm/chat -> AI_MODELS.CHAT (gpt-5.1)
- /api/llm/prefill -> AI_MODELS.PREFILL (gpt-5-nano)

Evidence: src/server/src/llm/validate.ts (resolveModel + defaults), src/config/aiModels.ts.

## C) CORS + Cookies (Prod Behavior)

### CORS
- CORS allows origins from ALLOWED_ORIGINS if set, else defaults to https://beta.arnvoid.com plus dev origins.
- credentials: true
- allowedHeaders: Content-Type, Authorization
Evidence: src/server/src/index.ts (corsOptions).

### Cookies
- Cookie name is arnvoid_session (default).
- SameSite: lax
- Secure: true when running in prod (K_SERVICE or NODE_ENV=production)
- HttpOnly: true
- Path: /
Evidence: src/server/src/index.ts (COOKIE_NAME, resolveCookieOptions, clearSessionCookie).

### Proxy
- trust proxy is enabled with level 1 to allow secure cookies behind Cloud Run.
Evidence: src/server/src/index.ts (app.set("trust proxy", 1)).

## D) Production Smoke Tests (curl)

No secrets included below. Replace placeholders with your own values.

### 1) 401 (no cookies)
```
curl -s -D - \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"text":"hello","nodeCount":3}' \
  https://<CLOUD_RUN_URL>/api/llm/paper-analyze
```
Expected: 401 + { ok:false, code:"unauthorized" }

### 2) Authenticated test (use browser cookie)
- Open your app in browser, copy the arnvoid_session cookie value.
- Use in curl (do NOT paste into docs):
```
curl -s -D - \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: arnvoid_session=<PASTE_COOKIE>" \
  -d '{"text":"short test text","nodeCount":3}' \
  https://<CLOUD_RUN_URL>/api/llm/paper-analyze
```
Expected: 200 + { ok:true, request_id, json }

### 3) Streaming test
```
curl -N -s -D - \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: arnvoid_session=<PASTE_COOKIE>" \
  -d '{"userPrompt":"Hello","context":{}}' \
  https://<CLOUD_RUN_URL>/api/llm/chat
```
Expected: raw text chunks streamed.

## E) Env Vars Required

Required:
- OPENAI_API_KEY
- INSTANCE_CONNECTION_NAME
- DB_NAME
- DB_USER
- DB_PASSWORD

Optional:
- OPENAI_RESPONSES_URL
- ALLOWED_ORIGINS
- NODE_ENV
- SESSION_COOKIE_NAME
- SESSION_TTL_MS

## Commands Used for Verification (examples)
These are safe templates only. Do not include secrets:
```
gcloud run services describe arnvoid-api --region asia-southeast2 --project arnvoid-project
curl -s -D - https://<CLOUD_RUN_URL>/health
```

End of report.
