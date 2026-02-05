# Report: Auth Session Wiring (2026-02-05)

## Summary
Implemented basic Google login exchange that sets a session cookie and exposes /me, plus frontend fetch credential handling.

## Changes
- Backend: Added /auth/google, /me, and /auth/logout with httpOnly session cookie and simple in-memory session storage.
- Backend: Added minimal CORS allowlist support for credentialed requests.
- Frontend: apiGet now uses credentials: include.
- Frontend: GoogleLoginButton now sends credentials and no longer stores user data in localStorage.

## Rationale
- Cookies will not be sent unless fetch uses credentials: include.
- SameSite and Secure must be explicitly set for cross-site cookies.
- Removing localStorage avoids token based auth remnants.

## Risks and Gaps
- Sessions are stored in memory. This is not safe for Cloud Run scale-out or restarts.
- Google token validation uses tokeninfo. This is easy but not the strongest verification path.

## Manual Checks Performed
- Code review only.
