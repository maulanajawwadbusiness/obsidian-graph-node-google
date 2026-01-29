# Vercel Readiness Scandissect Report

## 1. Critical Blockers (Must Fix)

### A. AI API Key Leakage
- **Status**: **UNSAFE**
- **Finding**: `OpenAIClient` is instantiated with an API key on the client side. `src/ai/openaiClient.ts` makes direct `fetch` calls to `https://api.openai.com/v1/responses`.
- **Impact**: Deploying this would expose the OpenAI key to anyone inspecting network traffic.
- **Fix**: **MUST** implement Vercel Serverless Functions (`api/chat` endpoint) and proxy the calls. Client should not receive the key.

### B. AI Mode Default Unsafe
- **Status**: **UNSAFE**
- **Finding**: `src/config/aiMode.ts` defaults to `'real'` if `VITE_AI_MODE` is missing or invalid.
- **Impact**: If env vars are missing on Vercel, the app will try to make real calls (likely failing due to missing key, or worse, using a baked-in dev key if one existed).
- **Fix**: Change default return to `'mock'`.

## 2. Potential Issues (Needs Cleanup)

### A. Inconsistent PDF Worker Source
- **Status**: **MIXED**
- **Finding**:
    - `src/ArnvoidDocumentViewer/.../pdfjs.ts` tries to load from `${import.meta.env.BASE_URL}pdf.worker.min.mjs` (Local file expectation).
    - `src/document/parsers/pdfParser.ts` loads from `cdn.jsdelivr.net` (CDN).
- **Impact**: If `public/pdf.worker.min.mjs` is missing in the build output, the Viewer will fail while the Parser succeeds.
- **Fix**: Unify to CDN or ensure `vite-plugin-static-copy` handles the worker file. CDN is safer/easier for Vercel.

### B. Node Polyfills
- **Status**: **CLEAN (Mostly)**
- **Finding**: No obvious `fs`, `path`, or `crypto` imports in client code.
- **Note**: `src/document/parsers/pdfParser.ts` uses `crypto.randomUUID()`. This is supported in modern browsers and Vercel Edge/Node runtimes, so it should be fine.

## 3. Configuration & Routing

### A. Routing
- **Status**: **SAFE**
- **Finding**: No `react-router` or client-side routing library found. App appears to be a single-view state machine.
- **Action**: Standard Vite build output should work without `vercel.json` rewrites (unless deep linking is a feature I missed).

### B. Build Scripts
- **Status**: **OK**
- **Finding**: `npm run build` runs `tsc && vite build`.
- **Action**: Check strictness of `tsc` locally.

## 4. Action Plan

1.  **Local Build**: Verify clean build.
2.  **Env Safety**: Fix `aiMode.ts` to default to `mock`.
3.  **Serverless Architecture**:
    - Create `api/openai.ts` (or similar) for Vercel function.
    - Refactor `OpenAIClient` to fetch from `/api/openai` instead of direct OpenAI.
4.  **Assets**: Unify PDF worker to CDN to avoid build asset path issues.
