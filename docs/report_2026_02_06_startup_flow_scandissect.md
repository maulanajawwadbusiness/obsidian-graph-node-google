# Scandissect Report: Startup Flow Architecture
**Date**: 2026-02-06  
**Agent**: Claude (Maulana Core Mode)  
**Mission**: Map 3-screen startup flow, fullscreen handling, login overlay wiring  
**Status**: Investigation complete. Architecture mapped. Ready for design phase.

---

## Overview

The app uses a simple local state machine in `AppShell.tsx` with 4 states (welcome1, welcome2, prompt, graph). No fullscreen logic exists yet. The prompt screen currently shows a non-functional input placeholder and mounts `LoginOverlay` with `open={true}` to enforce auth. Graph map lives in lazy-loaded `GraphPhysicsPlayground`. Fonts use Quicksand (UI) and Segoe UI/Public Sans (titles) via CSS custom properties. All onboarding screens are inline-styled components with placeholder content.

---

## 1. Entry + Routing

### Main Entry Point
**File**: `src/main.tsx`

**Structure**:
```tsx
<GoogleOAuthProvider>
  <AuthProvider>
    <AppShell />
  </AuthProvider>
</GoogleOAuthProvider>
```

**Auth Context**: `AuthProvider` wraps entire app, provides `useAuth()` hook globally.

### Routing Logic
**File**: `src/screens/AppShell.tsx`

**State Machine**:
- Type: Local React state (`useState<Screen>`)
- States: `'welcome1' | 'welcome2' | 'prompt' | 'graph'`
- No react-router, no URL routing — pure component switching

**Initial State Logic**:
```typescript
function getInitialScreen(): Screen {
    if (!ONBOARDING_ENABLED) return 'graph';  // Bypass
    if (PERSIST_SCREEN && sessionStorage) {   // Persistence (default OFF)
        const stored = sessionStorage.getItem('arnvoid_screen');
        if (valid) return stored;
    }
    return 'welcome1';  // Default entry
}
```

**State Transitions** (callbacks passed as props):
```
welcome1 --onNext-->  welcome2
welcome1 --onSkip-->  graph
welcome2 --onBack-->  welcome1
welcome2 --onNext-->  prompt
welcome2 --onSkip-->  graph
prompt   --onBack-->  welcome2
prompt   --onEnter--> graph (requires auth via LoginOverlay)
prompt   --onSkip-->  graph
```

**Graph Lazy Loading**:
```tsx
const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);
```
- Only imported when `screen === 'graph'`
- Prevents physics engine from loading during onboarding

### Environment Toggle
**File**: `src/config/env.ts`

**Var**: `VITE_ONBOARDING_ENABLED`  
**Values**: `'true'` or `'1'` to enable, anything else disables  
**Export**: `export const ONBOARDING_ENABLED: boolean`

**Current State** (from `.env.local`):
```
VITE_ONBOARDING_ENABLED=true
```

**Behavior**:
- `false`: App jumps directly to graph (skips all onboarding)
- `true`: App starts at `welcome1`

---

## 2. Current Onboarding Placeholders

### Welcome Screen 1
**File**: `src/screens/Welcome1.tsx`

**Props**:
```tsx
{
  onNext: () => void;
  onSkip: () => void;
}
```

**Content**:
```
Title: "Welcome"
Body: "This is a placeholder for welcome page 1."
Buttons: [Next (primary), Skip (secondary)]
```

**Layout**: Centered card, fullscreen dark void background (`#0f1115`)

### Welcome Screen 2
**File**: `src/screens/Welcome2.tsx`

**Props**:
```tsx
{
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}
```

**Content**:
```
Title: "Welcome"
Body: "This is a placeholder for welcome page 2."
Buttons: [Back, Next (primary), Skip]
```

**Layout**: Same as Welcome1, adds Back button

### Prompt Screen
**File**: `src/screens/EnterPrompt.tsx`

**Props**:
```tsx
{
  onEnter: () => void;
  onBack: () => void;
  onSkip: () => void;
}
```

**Content**:
```
Title: "Enter Prompt"
Body: "Placeholder page. Use the sign-in overlay to continue."
Visual: Non-functional input placeholder box
Overlay: <LoginOverlay open={true} />
```

**Critical Detail**: Input is **visual-only** (styled `div`, not `input`/`textarea`).

**Overlay Mount**:
```tsx
<LoginOverlay 
  open={true} 
  onContinue={onEnter} 
  onBack={onBack} 
  onSkip={onSkip} 
/>
```

### Screen Wiring (State Machine)

**AppShell.tsx orchestration**:
```tsx
const [screen, setScreen] = useState<Screen>(() => getInitialScreen());

if (screen === 'welcome1') return <Welcome1 onNext={...} onSkip={...} />;
if (screen === 'welcome2') return <Welcome2 onBack={...} onNext={...} onSkip={...} />;
if (screen === 'prompt') return <EnterPrompt onBack={...} onEnter={...} onSkip={...} />;
if (screen === 'graph') return <Suspense><Graph /></Suspense>;
```

**No step index, no routes** — just local state + conditional rendering.

### Timers/Durations

**None found**. No auto-advance, no timed transitions. All progression is user-driven via button clicks.

**SessionStorage Persistence** (disabled by default):
```tsx
const PERSIST_SCREEN = false;  // Toggle in AppShell.tsx
const STORAGE_KEY = 'arnvoid_screen';
```
- If enabled, saves current screen on state change
- Restores on refresh via `getInitialScreen()`

---

## 3. Fullscreen Handling

### Existing Logic

**Status**: ❌ **None found**.

**Search Results**:
- No `fullscreen`, `requestFullscreen`, `exitFullscreen`, or `document.fullscreenElement` usage
- No fullscreen context, hook, or state management
- One false positive: `seedPopupTypes.ts` comment mentions "fullscreen overlay" (unrelated, refers to popup masking layer)

### Icon Assets

**Confirmed Paths**:
```
src/assets/fullscreen_open_icon.png
src/assets/fullscreen_close_icon.png
```

**Import Style** (for components in `src/screens/` or `src/onboarding/`):
```tsx
import fullscreenOpenIcon from '../assets/fullscreen_open_icon.png';
import fullscreenCloseIcon from '../assets/fullscreen_close_icon.png';
```

**Usage Pattern** (to be implemented):
```tsx
<img src={fullscreenOpenIcon} alt="Enter fullscreen" />
```

### Existing Icon Button Components

**Reusable Components** (for consistency):

**1. SendButton** (`src/components/SendButton.tsx`):
- Props: `onClick`, `disabled`
- Style: 40px square, rounded, energy blue fill, scales on hover
- Pattern: Could be abstracted for fullscreen button

**2. Close/Action Buttons** (inline patterns):
- Found in `FullChatbar.tsx`: Close button style (commented SVG)
- Found in `LoginOverlay.tsx`: Primary/secondary button styles
- Pattern: Consistent 10px padding, 8px radius, 14px font

**Recommendation**: Create new `IconButton` component or adapt `SendButton` pattern for fullscreen toggle.

---

## 4. Prompt Screen / "ChatGPT-like" Layout

### Current Prompt Screen Component
**File**: `src/screens/EnterPrompt.tsx`

**Layout**:
```tsx
<div style={ROOT_STYLE}>  {/* fullscreen flex center */}
  <div style={CARD_STYLE}>  {/* centered card, 520px max */}
    <div style={TITLE_STYLE}>Enter Prompt</div>
    <div style={BODY_STYLE}>Placeholder page...</div>
    <div style={INPUT_PLACEHOLDER_STYLE}>Prompt input placeholder</div>
  </div>
  <LoginOverlay open={true} ... />
</div>
```

**Input "Field"**:
- Not a real input — styled `div`
- Style: `#141923` bg, `#2b2f3a` border, 12px padding, 8px radius
- Text color: `#7f8796` (ghost level)

### Global Layout Container
**File**: `src/screens/AppShell.tsx`

**Container**: None. Each screen is a direct child of `AppShell.tsx` render.

**Structure**:
```
AppShell
├── Welcome1 (fullscreen)
├── Welcome2 (fullscreen)
├── EnterPrompt (fullscreen)
└── Suspense -> Graph (fullscreen)
```

**No shared wrapper/shell**. Each component owns its root layout.

### Reusable Input Components

**1. ChatInput** (`src/popup/ChatInput.tsx`):
- Auto-expanding textarea (1-5 lines)
- Props: `placeholder`, `onSend`
- Style: `rgba(99,171,255,0.05)` bg, 12px radius, 40-120px height
- Pattern: Could be adapted for prompt screen

**2. FullChatbar Input** (`src/fullchat/FullChatbar.tsx`):
- Similar to ChatInput
- Integrated with streaming AI context
- More complex (message state, context badges)

**Recommendation**: For prompt screen, adapt `ChatInput` pattern (simpler, self-contained).

---

## 5. Login Overlay + Auth Wiring

### Login Overlay Component
**File**: `src/auth/LoginOverlay.tsx`

**Props**:
```tsx
{
  open: boolean;
  mode?: 'prompt';  // Unused, reserved
  onContinue?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}
```

**States**:
1. **Loading**: Shows "checking session..." (auth bootstrap)
2. **Not Signed In**: Renders `<GoogleLoginButton />`
3. **Signed In**: Shows user avatar + name, enables Continue
4. **Error**: Displays error message

**Show/Hide Logic**:
```tsx
if (!open) return null;
```
- Controlled externally via `open` prop
- Currently hardcoded `open={true}` in `EnterPrompt.tsx`

**Auth State Binding**:
```tsx
const { user, loading, error } = useAuth();

// Continue button disabled until auth
<button disabled={!user} onClick={onContinue}>Continue</button>
```

**Transition After Login**:
```tsx
// In EnterPrompt.tsx:
<LoginOverlay 
  open={true} 
  onContinue={onEnter}  // onEnter={() => setScreen('graph')}
/>
```
- User logs in -> `user` becomes non-null -> Continue enabled
- User clicks Continue -> `onContinue()` fires -> `setScreen('graph')`
- Graph lazy-loads and mounts

**Overlay Safety** (System.md contract compliance):
```tsx
<div style={BACKDROP_STYLE}
     onPointerDown={(e) => e.stopPropagation()}
     onWheel={(e) => e.stopPropagation()}>
  <div style={CARD_STYLE} onPointerDown={(e) => e.stopPropagation()}>
```
- Blocks all pointer/wheel events from reaching background
- Sets `document.body.overflow = 'hidden'` on mount
- zIndex: 2000 (above everything except analysis overlay at 3000)

### AuthProvider (Single Source of Truth)
**File**: `src/auth/AuthProvider.tsx`

**Mount Point**: `src/main.tsx`, wraps entire app tree

**Context Value**:
```tsx
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

**Bootstrap Flow**:
1. `AuthProvider` mounts
2. Calls `refreshMe()` on mount (`useEffect` + `didInitRef`)
3. Fetches `GET /me` with `credentials: "include"`
4. Updates `user` state
5. All components read via `useAuth()` hook

**Window Focus Refresh**:
```tsx
useEffect(() => {
  const handleFocus = () => {
    // Throttled to 30s
    if (now - lastFocusRefreshMs < 30000) return;
    void refreshMe();
  };
  window.addEventListener('focus', handleFocus);
}, [refreshMe]);
```

### Google Login Button
**File**: `src/components/GoogleLoginButton.tsx`

**OAuth Flow**:
1. User clicks Google button (from `@react-oauth/google`)
2. Google popup returns `idToken`
3. Frontend POSTs to `${API_BASE}/auth/google` with `{ idToken }`
4. Backend verifies token, creates session, sets `arnvoid_session` cookie
5. Frontend calls `refreshMe()` to update context
6. `LoginOverlay` detects `user` and enables Continue

**API Endpoint**: `/auth/google` (POST)  
**Cookie**: `arnvoid_session` (httpOnly, sameSite: lax, secure in prod)

---

## 6. Fonts + Global Styles

### Font Declarations
**File**: `src/styles/fonts.css`

**Quicksand** (UI font):
```css
@font-face {
  font-family: 'Quicksand';
  src: url('../assets/Quicksand-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
```

**Public Sans** (title font):
```css
@font-face {
  font-family: 'Public Sans';
  src: url('../assets/fonts/public-sans/PublicSans-Bold.woff2') format('woff2'),
       url('../assets/fonts/public-sans/PublicSans-Bold.woff') format('woff'),
       url('../assets/fonts/public-sans/PublicSans-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

**CSS Custom Properties**:
```css
:root {
  --font-ui: 'Quicksand', Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  --font-title: 'Segoe UI', 'Segoe UI Variable', 'Public Sans', system-ui, -apple-system, sans-serif;
  --font-title-weight: 700;
}
```

**Global Application**:
```css
html, body {
  font-family: var(--font-ui);
}
```

### Typography System

**Preferred Pattern**: Inline `CSSProperties` objects (current approach in all screens)

**Alternative Pattern** (available but unused in onboarding):
```tsx
// Data attribute approach
<div data-font="title">Arnvoid</div>

// CSS:
[data-font='title'] {
  font-family: var(--font-title);
}
```

**Current Onboarding Pattern**:
```tsx
const TITLE_STYLE: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    fontFamily: 'inherit',  // Inherits from :root
};
```

### Layout Components

**No existing "hero" or "centered fullpage" components**. Each screen defines its own:

```tsx
const ROOT_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    background: '#0f1115',
    color: '#e7e7e7',
};
```

**Pattern is consistent** across Welcome1, Welcome2, EnterPrompt.

**Recommendation**: For title card screen, reuse this pattern. For left-aligned intro, modify to `alignItems: 'flex-start'` + `justifyContent: 'flex-start'`.

---

## 7. Graph Map Placeholder

### Graph Rendering
**File**: `src/playground/GraphPhysicsPlayground.tsx`

**Component**: `GraphPhysicsPlayground` (exported)

**Structure**:
```tsx
export const GraphPhysicsPlayground: React.FC = () => {
  return (
    <DocumentProvider>
      <PopupProvider>
        <FullChatProvider>
          <GraphPhysicsPlaygroundInternal />
        </FullChatProvider>
      </PopupProvider>
    </DocumentProvider>
  );
};
```

**Internal Component** (actual render):
```tsx
const GraphPhysicsPlaygroundInternal: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PhysicsEngine>(null!);
  
  // Canvas + overlays
  return (
    <div style={CONTAINER_STYLE}>
      <canvas ref={canvasRef} />
      <CanvasOverlays />
      <SidebarControls />
      <MapTitleBlock />
      <BrandLabel />
      <FullChatbar />
      <PopupPortal />
      {/* ... */}
    </div>
  );
};
```

**Container Style** (`graphPlaygroundStyles.ts`):
```tsx
export const CONTAINER_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    background: '#0a0a12',  // Dark void
};
```

**Canvas Element**:
- Fullscreen, `position: absolute`
- Physics engine renders to this
- Lowest z-index (background layer)

### "Sample Map Preview" Mounting Point

**For prompt screen integration**:

**Option A**: Render mini graph in prompt screen background
- Would need to mount a second canvas (not recommended, performance)
- Or use static SVG/PNG preview

**Option B**: Mount full graph but dim/blur it
- Prompt input + overlay float on top
- Graph is interactive but obscured
- More complex but "real"

**Option C**: Static image/illustration
- Simplest
- Add as background image in prompt screen ROOT_STYLE

**Current Recommendation**: Option C (static preview) for first iteration. Graph only mounts after login completes.

---

## File Reference Table

### Entry + Routing
| File | Purpose | Lines | Key Exports |
|------|---------|-------|-------------|
| `src/main.tsx` | App entry | 24 | ReactDOM render |
| `src/screens/AppShell.tsx` | State machine | 73 | `AppShell` |
| `src/config/env.ts` | Env toggle | 3 | `ONBOARDING_ENABLED` |

### Onboarding Screens
| File | Purpose | Lines | Key Props |
|------|---------|-------|-----------|
| `src/screens/Welcome1.tsx` | Screen 1 | 89 | `onNext`, `onSkip` |
| `src/screens/Welcome2.tsx` | Screen 2 | 99 | `onNext`, `onSkip`, `onBack` |
| `src/screens/EnterPrompt.tsx` | Prompt + login | 62 | `onEnter`, `onBack`, `onSkip` |

### Auth System
| File | Purpose | Lines | Key Exports |
|------|---------|-------|-------------|
| `src/auth/AuthProvider.tsx` | Auth context | 163 | `AuthProvider`, `useAuth` |
| `src/auth/LoginOverlay.tsx` | Login modal | 219 | `LoginOverlay` |
| `src/components/GoogleLoginButton.tsx` | OAuth button | 95 | `GoogleLoginButton` |

### Graph System
| File | Purpose | Lines | Key Exports |
|------|---------|-------|-------------|
| `src/playground/GraphPhysicsPlayground.tsx` | Main graph | 378 | `GraphPhysicsPlayground` |
| `src/playground/graphPlaygroundStyles.ts` | Layout styles | ~50 | `CONTAINER_STYLE` |

### Typography
| File | Purpose | Lines | Key Exports |
|------|---------|-------|-------------|
| `src/styles/fonts.css` | Font faces | 45 | CSS vars `--font-ui`, `--font-title` |

### Input Components (Reusable)
| File | Purpose | Lines | Key Props |
|------|---------|-------|-----------|
| `src/popup/ChatInput.tsx` | Auto-expand textarea | 127 | `placeholder`, `onSend` |
| `src/components/SendButton.tsx` | Icon button | ~60 | `onClick`, `disabled` |

---

## Component Props Quick Reference

### AppShell Screen Callbacks
```tsx
// Welcome1
onNext: () => setScreen('welcome2')
onSkip: () => setScreen('graph')

// Welcome2
onBack: () => setScreen('welcome1')
onNext: () => setScreen('prompt')
onSkip: () => setScreen('graph')

// EnterPrompt
onBack: () => setScreen('welcome2')
onEnter: () => setScreen('graph')  // Auth-gated
onSkip: () => setScreen('graph')
```

### LoginOverlay
```tsx
open: boolean                // Show/hide
mode?: 'prompt'              // Unused (reserved)
onContinue?: () => void      // Fires when Continue clicked
onBack?: () => void          // Optional back button
onSkip?: () => void          // Optional skip button
```

---

## Design Notes for Next Phase

### Screen 1: Title Card
**Current File**: `src/screens/Welcome1.tsx` (to be redesigned)

**Requirements**:
- Fullscreen
- Large title: "Arnvoid / Antarmuka Pengetahuan Dua Dimensi"
- Fullscreen icon (open) in corner
- Dark void background
- Auto-advance after duration OR manual next

**Missing**:
- Timer logic for auto-advance
- Fullscreen API integration
- Icon button component

### Screen 2: Left-Aligned Intro
**Current File**: `src/screens/Welcome2.tsx` (to be redesigned)

**Requirements**:
- Left-aligned text (not centered)
- Longer copy
- No fullscreen icon (only on screen 1 and 3)
- Same dark void background
- Manual navigation (no auto-advance)

**Changes Needed**:
- Modify `ROOT_STYLE` to `alignItems: 'flex-start'`
- Adjust `CARD_STYLE` to left-align + more content space

### Screen 3: Prompt + Login
**Current File**: `src/screens/EnterPrompt.tsx` (to be enhanced)

**Requirements**:
- ChatGPT-like layout (centered input pill)
- Real input field (replace placeholder div)
- Fullscreen icon (close) in corner
- Google login overlay on top
- After login, user stays on prompt screen (can type)

**Changes Needed**:
- Replace `INPUT_PLACEHOLDER_STYLE` div with real `ChatInput` adaptation
- Add fullscreen icon button
- Keep `LoginOverlay` mount but consider `open` state management
- Wire up input submission (what happens on send?)

### Fullscreen Implementation
**To Be Created**:
- Hook: `useFullscreen()` or context
- State: `isFullscreen: boolean`
- Methods: `enterFullscreen()`, `exitFullscreen()`, `toggleFullscreen()`
- Browser API: `document.documentElement.requestFullscreen()`, `document.exitFullscreen()`
- Event listener: `fullscreenchange` to sync state

**Icon Button Pattern**:
```tsx
<button onClick={toggleFullscreen} style={ICON_BUTTON_STYLE}>
  <img 
    src={isFullscreen ? fullscreenCloseIcon : fullscreenOpenIcon} 
    alt="Toggle fullscreen" 
  />
</button>
```

---

## Implementation Checklist (For Next Phase)

### Phase 1: Fullscreen System
- [ ] Create `src/hooks/useFullscreen.ts`
- [ ] Implement `requestFullscreen` / `exitFullscreen` logic
- [ ] Add `fullscreenchange` event listener
- [ ] Create `FullscreenButton` component
- [ ] Test cross-browser (Chrome, Firefox, Safari)

### Phase 2: Screen 1 (Title Card)
- [ ] Redesign `Welcome1.tsx` with large title
- [ ] Add fullscreen button (open icon)
- [ ] Add auto-advance timer (optional)
- [ ] Apply Dark Elegance typography

### Phase 3: Screen 2 (Intro Text)
- [ ] Redesign `Welcome2.tsx` with left-aligned layout
- [ ] Write real intro copy
- [ ] Remove fullscreen button (not on screen 2)
- [ ] Adjust spacing for longer content

### Phase 4: Screen 3 (Prompt + Login)
- [ ] Replace placeholder div with real input
- [ ] Adapt `ChatInput` component pattern
- [ ] Add fullscreen button (close icon)
- [ ] Refine `LoginOverlay` integration
- [ ] Wire up input submission (TBD: does it trigger graph load?)

### Phase 5: Auth Flow Refinement
- [ ] After login, keep user on prompt screen
- [ ] Allow typing before navigating to graph
- [ ] Consider storing initial prompt in AppShell state
- [ ] Pass prompt to graph on mount (if applicable)

---

## Architecture Quality Assessment

**Strengths**:
- ✅ Clean state machine (easy to extend)
- ✅ Auth system is robust (follows system.md contracts)
- ✅ Lazy loading prevents physics engine overhead
- ✅ Consistent styling patterns across screens
- ✅ No routing complexity (local state only)

**Weaknesses**:
- ⚠️ No fullscreen system (needs implementation)
- ⚠️ Input is visual placeholder (not functional)
- ⚠️ No transitions between screens (instant swap)
- ⚠️ Duplicate style constants (could extract)

**Risk Level**: 🟢 Low. Simple architecture, clear boundaries, easy to modify.

---

## Quick Navigation Map

```
main.tsx
  └─> AppShell.tsx (state machine)
       ├─> Welcome1.tsx (screen 1) [redesign target]
       ├─> Welcome2.tsx (screen 2) [redesign target]
       ├─> EnterPrompt.tsx (screen 3) [enhance target]
       │    └─> LoginOverlay.tsx [keep, minor polish]
       │         └─> GoogleLoginButton.tsx [no changes]
       └─> GraphPhysicsPlayground.tsx (lazy, after login)
```

**Parallel Systems** (no changes needed):
- `AuthProvider.tsx` (wraps tree, global context)
- `fonts.css` (already configured)
- `config/env.ts` (toggle works)

---

**End of Report**

**Status**: Architecture fully mapped. No code changes made. Ready for 3-screen design implementation.

**Next Step**: Design phase — wireframe layouts, copy writing, fullscreen UX flow.

**Estimated Implementation Time**: 
- Fullscreen system: 1-2 hours
- Screen redesigns: 2-3 hours
- Input wiring: 1 hour
- Polish + testing: 1 hour
**Total**: ~5-7 hours for full 3-screen flow.
