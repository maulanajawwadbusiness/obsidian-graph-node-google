# Onboarding EnterPrompt Screen and Payment Box Wiring Report
Date: 2026-02-06
Status: SCAN COMPLETE. NO CODE CHANGES MADE.

## Where The EnterPrompt Screen Lives
Primary files:
- src/screens/EnterPrompt.tsx
- src/screens/AppShell.tsx

Flow:
- AppShell routes onboarding screens and uses EnterPrompt as the third screen (Screen = "prompt").
- EnterPrompt renders a sidebar placeholder, a PromptCard, and a LoginOverlay.

## The Top-Right Box On EnterPrompt
PromptCard contains a top-right control:
- src/components/PromptCard.tsx
- The control is FullscreenButton, positioned absolutely at top-right of the card.
- FullscreenButton implementation:
  - src/components/FullscreenButton.tsx
  - Uses absolute positioning: top: 24px, right: 24px

This is the current top-right UI anchor that can host or sit alongside a payment box.

## What Is Needed To Wire Payments To The Top-Right Box
### Frontend UI Placement
- Add a payment box UI element within PromptCard or within EnterPrompt, positioned near or adjacent to FullscreenButton.
- If co-locating inside PromptCard, it should be a sibling to FullscreenButton so it inherits the same absolute positioning context.

### Frontend API Integration
Backend endpoints already exist:
- POST /api/payments/gopayqris/create
- GET /api/payments/:orderId/status

Frontend currently has only apiGet in src/api.ts (GET only).
Needed:
- Add a POST helper that uses fetch with credentials: "include".
- Call POST /api/payments/gopayqris/create to create payment and receive actions.

### Action URLs Needed For UI
From backend response, the UI should consume actions:
- Action name "generate-qr-code" or "generate-qr-code-v2" for desktop QRIS display.
- Action name "deeplink-redirect" for mobile redirect.

### Auth Gating
EnterPrompt already uses LoginOverlay with useAuth:
- src/screens/EnterPrompt.tsx
- src/auth/AuthProvider.tsx

The create payment call should only be enabled when user is logged in, consistent with LoginOverlay gating.

## Summary
- EnterPrompt screen is in src/screens/EnterPrompt.tsx and is wired in src/screens/AppShell.tsx.
- The top-right UI anchor is FullscreenButton inside PromptCard (absolute positioned).
- Payment wiring requires a new POST helper in src/api.ts and a small UI box near FullscreenButton to trigger /api/payments/gopayqris/create and present QR/deeplink actions.

