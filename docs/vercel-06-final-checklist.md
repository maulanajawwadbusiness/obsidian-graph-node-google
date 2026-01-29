# Deployment Guide (Vercel)

## Readiness Status: READY

### 1. Build Verification
Local build passed:
`npm run build` -> Exit Code 0.

### 2. Environment Variables
Ensure these variables are set in Vercel Project Settings:
- `VITE_AI_MODE`: `real` (or `mock` for testing).
- `OPENAI_API_KEY`: Required if using `real` mode (Note: Client-side usage is UNSAFE, but accepted by user).

### 3. Deployment Steps
1. Push code to GitHub/GitLab.
2. Import project into Vercel.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Add Environment Variables.
7. Click **Deploy**.

### 4. Known Risks (User Accepted)
- **API Key Leakage**: The app uses client-side fetch to OpenAI. The key IS visible in network tab.
- **Solution**: Switch to Vercel AI SDK or Proxy Function later.

### 5. Troubleshooting
- If "Module not found" for `pdf.worker.mjs`, check `specs/docs/vercel-04-assets-and-workers.md`.
- If "Build failed", check `specs/docs/vercel-01-local-build.md`.
