# Local API Proxy Fix (Vite Dev + Preview)

## Problem
- Frontend calls use `VITE_API_BASE_URL` from `src/api.ts`.
- When base is `/api`, local Vite servers need proxy forwarding.
- `vercel.json` rewrites do not apply to `vite dev` or `vite preview`.

## Change
- Added optional `/api` proxy wiring in `vite.config.ts` for both:
  - `server.proxy`
  - `preview.proxy`
- Proxy is enabled only when `VITE_DEV_API_PROXY_TARGET` is set to an `http` or `https` URL.
- `/api` prefix is preserved when forwarding.
- Updated `vercel.json` rewrite destination to preserve `/api` on upstream:
  - `/api/(.*)` -> `https://arnvoid-api-242743978070.asia-southeast2.run.app/api/$1`

## Local Usage
1. Set frontend base URL to `/api` if you want same-origin style calls.
2. Set `VITE_DEV_API_PROXY_TARGET` to your backend origin.
3. Run frontend with `npm run dev` or `npm run preview`.

Example:
- `VITE_API_BASE_URL=/api`
- `VITE_DEV_API_PROXY_TARGET=http://localhost:8080`

## Notes
- Existing direct-base mode (`VITE_API_BASE_URL=http://localhost:8080`) still works.
- This change does not alter API helper signatures or backend routes.
- Backend routes in this repo are mounted at `/api/*`, so gateways must not strip `/api`.
