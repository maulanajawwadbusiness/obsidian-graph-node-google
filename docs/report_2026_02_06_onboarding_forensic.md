# Forensic Report: Onboarding System Deep Dive
**Date**: 2026-02-06  
**Agent**: Claude (Maulana Core Mode)  
**Mission**: Scandissect onboarding flow, understand architecture, prepare for content edit  
**Status**: Investigation complete. Ready for edit phase.

---

## Executive Summary

The onboarding system is a minimal 3-screen flow (Welcome1 -> Welcome2 -> Prompt -> Graph) implemented as placeholder screens with a simple state machine in `AppShell.tsx`. The prompt screen integrates with Google login via `LoginOverlay` that enforces authentication before allowing continuation.

**Key Finding**: All three welcome/prompt screens are **placeholder implementations** waiting for real content. They follow Dark Elegance design patterns but contain dummy text ("This is a placeholder for welcome page 1").

**Architecture Quality**: Clean separation of concerns, proper auth integration, follows system contracts.

**Content Gap**: Screens need:
1. Real copy that explains Arnvoid's value proposition
2. Visual elements that match the "void with energy escaping" aesthetic
3. Progressive disclosure of features
4. Personality that matches the "thinking partner" brand

---

## 1. Flow Architecture (State Machine)

### 1.1 Entry Point

**File**: `src/main.tsx`

```
<GoogleOAuthProvider>
  <AuthProvider>
    <AppShell />
  </AuthProvider>
</GoogleOAuthProvider>
```

**Truth**: Auth context is global. All screens have access to `user`, `loading`, `error` via `useAuth()`.

### 1.2 State Machine

**File**: `src/screens/AppShell.tsx`

**States**: `welcome1 | welcome2 | prompt | graph`

**Initial State Logic**:
```typescript
function getInitialScreen(): Screen {
    if (!ONBOARDING_ENABLED) return 'graph';  // Bypass toggle
    if (PERSIST_SCREEN && sessionStorage) {
        const stored = sessionStorage.getItem('arnvoid_screen');
        if (valid) return stored;
    }
    return 'welcome1';  // Default entry
}
```

**Transitions**:
```
welcome1 --next-->  welcome2
welcome1 --skip-->  graph
welcome2 --back-->  welcome1
welcome2 --next-->  prompt
welcome2 --skip-->  graph
prompt   --back-->  welcome2
prompt   --enter--> graph (requires auth)
prompt   --skip-->  graph
```

**State Persistence**: 
- Controlled by `PERSIST_SCREEN` constant (default: `false`)
- If enabled, stores screen in `sessionStorage` under key `arnvoid_screen`
- Allows refresh to restore position

**Graph Lazy Loading**:
- Graph component is `React.lazy()` imported
- Only mounts when state = 'graph'
- Prevents heavy physics engine from loading during onboarding

---

## 2. Screen Implementations (Current State)

### 2.1 Welcome1.tsx

**Purpose**: First impression, hook the user

**Current Content**: 
```
Title: "Welcome"
Body: "This is a placeholder for welcome page 1."
Actions: [Next, Skip]
```

**Design Pattern**: Centered card on dark void background (`#0f1115`)

**Button Hierarchy**:
- Primary: "Next" (`#1f2430` fill)
- Secondary: "Skip" (transparent, `#c7cbd6` text)

**Missing**:
- Real value proposition
- Visual hook (maybe a subtle graph preview or energy ring)
- Brand personality
- Emotional connection

### 2.2 Welcome2.tsx

**Purpose**: Deepen understanding, show key features

**Current Content**:
```
Title: "Welcome"
Body: "This is a placeholder for welcome page 2."
Actions: [Back, Next, Skip]
```

**Design Pattern**: Same as Welcome1, adds "Back" button

**Missing**:
- Feature explanation
- Use case demonstration
- Differentiation from other tools
- Visual variety (still just text on card)

### 2.3 EnterPrompt.tsx

**Purpose**: Login gate, set initial intent (prompt)

**Current Content**:
```
Title: "Enter Prompt"
Body: "Placeholder page. Use the sign-in overlay to continue."
Visual: Input placeholder box (non-functional)
Overlay: LoginOverlay (enforces auth)
```

**Auth Integration**: 
- `LoginOverlay` always open (`open={true}`)
- "Continue" button disabled until user signs in
- Overlay blocks background interaction

**Unique Feature**: This is where auth requirement is enforced

**Missing**:
- Functional prompt input (what are they asking?)
- Explanation of what happens after login
- Preview of graph experience
- Personality in copy

---

## 3. Auth Integration Deep Dive

### 3.1 LoginOverlay Component

**File**: `src/auth/LoginOverlay.tsx`

**Props**:
```typescript
{
  open: boolean;
  mode?: 'prompt';  // Unused, reserved for future modes
  onContinue?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}
```

**States**:
1. **Loading**: "checking session..." (auth bootstrapping)
2. **Not Signed In**: Shows Google login button
3. **Signed In**: Shows user avatar + name, enables Continue
4. **Error**: Shows error message in red

**Critical UX Contract**:
- Backdrop blocks all pointer and wheel events (`stopPropagation`)
- Sets `document.body.overflow = 'hidden'` to prevent scroll
- Continue button `disabled={!user}` (enforces auth)

**Visual Design**:
- Modal card (`#0f1115` bg) on dark backdrop (`rgba(8,10,14,0.72)`)
- Follows Dark Elegance grammar
- Energy restraint: minimal blue, focus on function

### 3.2 Auth Flow (Google OAuth)

**File**: `src/components/GoogleLoginButton.tsx`

**Flow**:
```
1. User clicks Google button
2. Google popup returns `idToken`
3. Frontend POSTs to `/api/auth/google` with token
4. Backend verifies, creates session, sets cookie
5. Frontend calls `refreshMe()` to update context
6. LoginOverlay detects user and enables Continue
```

**Backend Contract** (from system.md):
- Cookie name: `arnvoid_session`
- `httpOnly: true`, `sameSite: "lax"`, `secure: true` in prod
- Session stored in Postgres
- All API calls use `credentials: "include"`

**Session Expiry Detection**:
- `AuthProvider` tracks `previousUserRef`
- If user was logged in and `/me` returns null, sets `sessionExpired: true`
- `SessionExpiryBanner` can be mounted elsewhere to show warning

### 3.3 Auth Provider (Single Source of Truth)

**File**: `src/auth/AuthProvider.tsx`

**Responsibilities**:
1. Bootstrap session on mount (`GET /me`)
2. Refresh on window focus (throttled 30s)
3. Detect session expiry
4. Provide logout
5. Expose `user`, `loading`, `error`, `sessionExpired` to all components

**Context Value**:
```typescript
{
  user: User | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  dismissSessionExpired: () => void;
}
```

---

## 4. Design System Analysis

### 4.1 Dark Elegance Grammar (Applied)

**Background**: `#0f1115` (void-deep level)

**Text Colors**:
- Bright: `#f2f2f2` (titles)
- Soft: `#c7cbd6` (buttons)
- Dim: `#b9bcc5` (body)

**Button Patterns**:
- Primary: `#1f2430` fill + `#2b2f3a` border
- Secondary: transparent + `#2b2f3a` border
- Disabled: cursor default, no hover state

**Energy Restraint**: Minimal blue. Only appears in:
- Login success state (signed-in box has subtle bg)
- Future: could appear on primary action (Continue beam)

**Spacing**: Comfortable but not luxurious. Gap: 16px, padding: 24px

**Vocabulary Used**:
- "void" in background
- "soft" in body text
- "dim" in placeholders
- Missing: "beam", "glow", "mesmerizing" (no energy accents yet)

### 4.2 Typography

**Font Stack**: Inherits from root (Quicksand primary via `fonts.css`)

**Sizes**:
- Welcome titles: 32px, weight 700
- Prompt title: 28px, weight 700
- Body: 16px, line-height 1.6
- Buttons: 14px

**Consistency**: All screens use identical styling constants

---

## 5. Technical Contracts (Compliance Check)

### 5.1 System.md Contracts

| Contract | Status | Evidence |
|----------|--------|----------|
| ASCII Only | ✅ Pass | No Unicode in code |
| `VITE_API_BASE_URL` | ✅ Pass | Used in LoginButton, AuthProvider |
| Cookie auth | ✅ Pass | `credentials: "include"` on all requests |
| Auth entry point | ✅ Pass | `GoogleLoginButton.tsx` |
| Session expiry detection | ✅ Pass | `AuthProvider` tracks previous user |

### 5.2 Overlay Input Safety (UI Surface Map)

**Critical Rule**: Canvas must not receive events when overlay is active.

**Compliance**:
```typescript
<div style={BACKDROP_STYLE}
     onPointerDown={(e) => e.stopPropagation()}
     onWheel={(e) => e.stopPropagation()}>
  <div style={CARD_STYLE}
       onPointerDown={(e) => e.stopPropagation()}>
```

**Verdict**: ✅ Pass. Follows Non-Negotiable overlay wrapper pattern from system.md.

### 5.3 Interaction Determinism

**Rule**: If it matches visually, it matches logically.

**Status**: ✅ Pass for current impl, but note:
- Input placeholder in `EnterPrompt` is visual only (not functional)
- Should either be real input or removed

---

## 6. Content Gap Analysis

### 6.1 Missing: Value Proposition

**Current**: "This is a placeholder..."

**Needed**: Why should user continue?

**Arnvoid Identity** (from vision.md + system.md):
- "Thinking partner inside your obsidian graph"
- "Conversational graph interface for deep reasoning"
- "Paper Essence Pipeline: Document -> Key Dots -> Interactive Graph"

**Suggested Angle for Welcome1**:
```
Title: "Your Graph, Alive"
Body: 
  Arnvoid turns complex documents into living knowledge maps.
  
  Watch ideas connect. Ask questions. Think deeper.
  
  No static notes. No dead files. Just your thoughts,
  breathing as a graph you can touch.
```

### 6.2 Missing: Feature Education

**Current**: No explanation of what happens after login

**Needed**: Preview graph experience, explain chat, show value

**Suggested Angle for Welcome2**:
```
Title: "How It Works"
Body:
  1. Drop a document (PDF, MD, TXT)
  2. AI finds the key ideas and connections
  3. Explore the graph, ask questions, synthesize
  
  Your knowledge becomes spatial. Your questions become 
  conversations. Your understanding becomes inevitable.
```

### 6.3 Missing: Personality

**Current**: Generic "welcome" voice

**Arnvoid Voice** (from design grammar + vision):
- Calm, intelligent, restrained
- Not cute, not aggressive
- "Inevitable" (design grammar), "alive but not chaotic" (vision)

**Tone Principles**:
- Use declarative statements, not questions
- Short sentences. Breathing room.
- No emoji, no exclamation marks (except rare moments)
- "You" not "we" (user-focused)

### 6.4 Missing: Visual Interest

**Current**: Text-only cards

**Opportunities**:
- Welcome1: Subtle animated ring (energy escaping from void)
- Welcome2: Mini graph preview (few dots connected)
- Prompt: Functional input field with subtle glow on focus

---

## 7. Recommendations for Edit Phase

### 7.1 Content Strategy

**Priority 1**: Write real copy for all three screens
- Follow Arnvoid voice principles
- Progressive disclosure (simple -> detailed -> action)
- Avoid feature lists, focus on feeling

**Priority 2**: Refine button copy
- "Next" -> "Continue" (softer)
- "Skip" -> "Skip Intro" or "Jump to Graph" (clearer)
- "Enter" -> "Start Thinking" (personality)

**Priority 3**: Add visual hooks
- Welcome1: Geometric shape (ring or spiral)
- Welcome2: Mini graph or document icon
- Prompt: Real input field (even if not wired yet)

### 7.2 Design Enhancements

**Energy Placement** (follow restraint rule: ≤5 places):
1. Title on Welcome1 (beam)
2. Primary button on prompt (glow when active)
3. Signed-in indicator (subtle)
4. Active input border (energy line)
5. (Optional) Geometric visual on Welcome1

**Spacing**: Current is comfortable. Could "breathe" more on Welcome2 (increase gap to 20px).

**Depth**: Add subtle `box-shadow` to cards for float effect.

### 7.3 Technical Improvements

**Low Priority** (not blockers):
- Make prompt input functional (store in AppShell state)
- Pass prompt to graph as initial query
- Add fade transitions between screens
- Consider `PERSIST_SCREEN=true` for dev QOL

---

## 8. Files to Edit (Edit Phase Roadmap)

### Primary Targets:
1. **`src/screens/Welcome1.tsx`** - Rewrite copy, add visual
2. **`src/screens/Welcome2.tsx`** - Rewrite copy, show features
3. **`src/screens/EnterPrompt.tsx`** - Rewrite copy, refine input

### Secondary (Optional):
4. **`src/auth/LoginOverlay.tsx`** - Enhance button labels, add energy accent
5. **`src/screens/AppShell.tsx`** - Add transitions (if requested)

### Do NOT Edit:
- `AuthProvider.tsx` (auth logic is solid)
- `GoogleLoginButton.tsx` (functional, matches system contracts)
- `AppShell.tsx` state machine (clean, no need to change)

---

## 9. Code Quality Assessment

### 9.1 Strengths

✅ **Clean Separation**: State machine in AppShell, content in components  
✅ **Type Safety**: Proper TypeScript, no `any` abuse  
✅ **Auth Integration**: Follows system.md contracts exactly  
✅ **Overlay Safety**: Proper event stopPropagation  
✅ **Lazy Loading**: Graph only loads when needed  
✅ **Maintainability**: Easy to understand, easy to modify  

### 9.2 Weaknesses

⚠️ **No Transitions**: Screen changes are instant (could be jarring)  
⚠️ **Input Placeholder**: Visual-only, misleading  
⚠️ **No Loading States**: AppShell fallback is basic  
⚠️ **Duplicate Styles**: Each screen defines its own constants (could extract)  

### 9.3 Verdict

**Architecture**: 8/10 (solid, follows contracts, room for polish)  
**Content**: 2/10 (placeholder text, no value prop)  
**Design**: 7/10 (follows grammar, lacks energy accents)  
**UX**: 6/10 (functional but bland, no personality)

---

## 10. Physics Engine Note

**Observation**: Onboarding screens are completely decoupled from physics engine.

**Impact**: We can edit onboarding without touching:
- `src/physics/` (engine)
- `src/playground/` (graph rendering)
- `src/graph/` (topology)

**Safety**: This is GOOD. Onboarding is pure UI layer.

**Config Check**: `EDGE_LEN_SCALE = 0.9` in `physics/config.ts` is current graph sizing. Onboarding doesn't need to know about this.

---

## 11. Final Checklist (Pre-Edit)

✅ **Understood Flow**: Welcome1 -> Welcome2 -> Prompt -> Graph  
✅ **Understood Auth**: Login enforced at prompt via LoginOverlay  
✅ **Understood Design Grammar**: Dark Elegance, energy restraint, void aesthetic  
✅ **Understood Voice**: Calm, inevitable, spatial thinking  
✅ **Understood Content Gap**: All three screens are placeholders  
✅ **Understood System Contracts**: ASCII, API base, cookie auth, overlay safety  
✅ **Understood Physics Boundary**: Onboarding is UI-only, no physics deps  

**Status**: Ready to edit.

**Next Step**: Await instruction to rewrite screens with real content.

---

## Appendix A: File Structure Reference

```
src/
├── screens/
│   ├── AppShell.tsx           # State machine (DO NOT EDIT)
│   ├── Welcome1.tsx           # EDIT TARGET 1
│   ├── Welcome2.tsx           # EDIT TARGET 2
│   └── EnterPrompt.tsx        # EDIT TARGET 3
├── auth/
│   ├── AuthProvider.tsx       # Auth context (DO NOT EDIT)
│   ├── LoginOverlay.tsx       # Optional polish
│   └── SessionExpiryBanner.tsx
├── components/
│   └── GoogleLoginButton.tsx  # Functional (DO NOT EDIT)
└── config/
    └── env.ts                 # ONBOARDING_ENABLED toggle
```

---

## Appendix B: Design Grammar Quick Reference

| Element | Vocabulary | CSS |
|---------|-----------|-----|
| Background | void-deep | `#0f1115` |
| Title | bright | `#f2f2f2` |
| Body | soft | `#b9bcc5` |
| Button primary | elevated | `#1f2430` |
| Button secondary | transparent | `#c7cbd6` |
| Energy accent | beam/glow | `#56C4FF` + shadow |
| Spacing | breathe | 16-24px gap/padding |

---

## Appendix C: Voice Principles

**DO**:
- Use declarative statements
- Short sentences
- User-focused ("you", "your")
- Spatial metaphors ("map", "graph", "connect")
- Calm confidence

**DON'T**:
- Questions (unless rhetorical)
- Exclamation marks (except rare emphasis)
- Emoji
- Corporate speak ("solutions", "leverage", "ecosystem")
- Aggressive CTAs ("Sign up NOW!")

---

**End of Report**

**Agent Status**: Investigation complete. Awaiting edit instructions.

**Estimated Edit Time**: 30-45 minutes for all three screens + LoginOverlay polish.

**Risk**: Low. Clean architecture, clear contracts, no physics dependencies.

**Confidence**: High. Ready to ship.
