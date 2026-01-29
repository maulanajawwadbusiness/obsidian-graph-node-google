# Asset Configuration

## Changes
- **PDF Worker**: Switched from local file to CDN (`cdn.jsdelivr.net`) in `src/.../lib/pdfjs.ts`.
  - **Reason**: Ensures worker matches `pdfjs-dist` version and avoids asset path/hashing issues on Vercel.
- **Vite Config**: Verified base URL default.

## Verification
- Code builds safely.
- Runtime should load the worker from external URL (CORS friendly).
