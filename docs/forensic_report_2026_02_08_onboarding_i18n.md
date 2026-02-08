# Forensic Report: Onboarding Screen and i18n System

Date: 2026-02-08
Scope: `welcome1`, `welcome2`, `enterprompt`, and i18n integration paths.

## 1. Executive Snapshot

Current onboarding text is split across two systems:
- Global i18n system: `src/i18n/*` with `t(key)` and language state from `getLang()`.
- Local per-component text constants: hardcoded strings inside onboarding components.

Result: onboarding language behavior is not unified. Some onboarding text can switch by prop (`PromptCard`), but most onboarding text is hardcoded and does not follow global language state.

## 2. What The Onboarding System Is

Flow owner:
- `src/screens/AppShell.tsx:19` defines screen FSM: `welcome1 -> welcome2 -> prompt -> graph`.
- Initial gate from env:
  - `src/config/env.ts:3` (`ONBOARDING_ENABLED`)
  - `src/screens/AppShell.tsx:26` (`getInitialScreen`)

Screen mounts:
- `src/screens/AppShell.tsx:112` mounts `Welcome1`.
- `src/screens/AppShell.tsx:125` mounts `Welcome2`.
- `src/screens/AppShell.tsx:139` mounts `EnterPrompt`.

Onboarding UX controls:
- Fullscreen global button mounted while onboarding: `src/screens/AppShell.tsx:41`, `src/screens/AppShell.tsx:52`.
- Global wheel guard during onboarding: `src/screens/AppShell.tsx:62`.
- First-gesture fullscreen retry: `src/screens/AppShell.tsx:79`.

## 3. What The i18n System Is

Language state:
- `src/i18n/lang.ts:6` language type is `id | en`.
- Priority chain in `getLang()`:
  1. `window.ARNVOID_LANG`: `src/i18n/lang.ts:19`
  2. `localStorage['arnvoid_lang']`: `src/i18n/lang.ts:25`
  3. `VITE_LANG`: `src/i18n/lang.ts:32`
  4. fallback `id`: `src/i18n/lang.ts:15`, `src/i18n/lang.ts:38`

Translator:
- `src/i18n/t.ts:16` is central `t(key, vars)`.
- Key type source is English dictionary keys: `src/i18n/t.ts:9`.
- Missing in active language falls back to English: `src/i18n/t.ts:23`.
- Missing everywhere returns marker string: `src/i18n/t.ts:30`.

Dictionary:
- `src/i18n/strings.ts:6` contains key-value texts for `id` and `en`.
- Coverage today is mostly popup/chat/viewer strings, not onboarding strings.

AI language coupling:
- `src/i18n/aiLanguage.ts:8` language directive for model output follows `getLang()`.

## 4. Where Onboarding Text Actually Comes From

### Welcome1
Source file: `src/screens/Welcome1.tsx`

Text ownership:
- Subtitle hardcoded Indonesian: `src/screens/Welcome1.tsx:34`
- Fullscreen prompt hardcoded English title/body/buttons:
  - `src/screens/Welcome1.tsx:116`
  - `src/screens/Welcome1.tsx:118`
  - `src/screens/Welcome1.tsx:127`
  - `src/screens/Welcome1.tsx:135`

i18n intersection:
- No `t(...)` call.
- No `getLang()` usage.
- No dictionary key path.

### Welcome2
Source files:
- `src/screens/Welcome2.tsx`
- `src/screens/welcome2ManifestoText.ts`

Text ownership:
- Main manifesto text is a single hardcoded English block: `src/screens/welcome2ManifestoText.ts:1`
- Aux button labels hardcoded English: `src/screens/Welcome2.tsx:170`, `src/screens/Welcome2.tsx:173`

i18n intersection:
- No `t(...)` call.
- No `getLang()` usage.
- Timeline system is language-agnostic technically, but fed with one authored text constant (`MANIFESTO_TEXT`).

### EnterPrompt shell
Source file: `src/screens/EnterPrompt.tsx`

Text ownership:
- Sidebar label hardcoded English: `src/screens/EnterPrompt.tsx:21`
- `PromptCard` forced to Indonesian: `src/screens/EnterPrompt.tsx:25` (`lang="id"`)

i18n intersection:
- EnterPrompt does not read `getLang()`.
- Language is not derived from global i18n state.

### PromptCard (inside EnterPrompt)
Source file: `src/components/PromptCard.tsx`

Text ownership:
- Local dictionary internal to component: `src/components/PromptCard.tsx:7`
- Language selected by prop only: `src/components/PromptCard.tsx:21`
- Hardcoded "Sample graph preview" not in local dictionary: `src/components/PromptCard.tsx:30`

i18n intersection:
- Uses a separate mini-i18n approach, not `src/i18n/t.ts`.

### LoginOverlay (inside EnterPrompt)
Source file: `src/auth/LoginOverlay.tsx`

Text ownership:
- Hardcoded English UI text:
  - `src/auth/LoginOverlay.tsx:42` Sign In
  - `src/auth/LoginOverlay.tsx:43` subtitle
  - `src/auth/LoginOverlay.tsx:46` Checking session
  - `src/auth/LoginOverlay.tsx:63` Signed in
  - `src/auth/LoginOverlay.tsx:80` Hide
  - `src/auth/LoginOverlay.tsx:89` Back
  - `src/auth/LoginOverlay.tsx:98` Continue
  - `src/auth/LoginOverlay.tsx:106` Skip

i18n intersection:
- No `t(...)` call.
- No `getLang()` usage.

## 5. How Text Connects To i18n Today

Connected to i18n:
- Popup, MiniChat, FullChat, document viewer, prefill prompt strings.
  - Example callsites:
    - `src/popup/NodePopup.tsx:210`
    - `src/popup/MiniChatbar.tsx:365`
    - `src/fullchat/FullChatbar.tsx:...` (uses `t`)
    - `src/fullchat/prefillSuggestion.ts:31`

Not connected to i18n:
- `Welcome1`, `Welcome2`, `EnterPrompt`, `LoginOverlay`, and most `PromptCard` labels.

Practical effect:
- A user can switch app language globally and AI response directive follows it, but onboarding screens still show mostly fixed strings.

## 6. Code Conflict, Overlap, Intersection

Conflict A: Dual localization systems
- System 1: global `t()` and `STRINGS`.
- System 2: local `PROMPT_TEXTS` in `PromptCard`.
- Overlap: both represent `id/en`, but keys and ownership are separate.
- Risk: drift and inconsistent translations.

Conflict B: Global language state bypass
- `EnterPrompt` passes `lang="id"` directly: `src/screens/EnterPrompt.tsx:25`.
- This ignores runtime language resolution (`getLang()` chain).
- Risk: onboarding prompt stuck in Indonesian even when global language is English.

Conflict C: Mixed language in single onboarding path
- `Welcome1` subtitle in Indonesian (`src/screens/Welcome1.tsx:34`) but fullscreen prompt in English (`src/screens/Welcome1.tsx:116` etc).
- `Welcome2` manifesto in English (`src/screens/welcome2ManifestoText.ts:1`) and buttons in English.
- `PromptCard` partly Indonesian due to forced prop.
- `LoginOverlay` English only.
- Risk: language context shifts screen-to-screen in same flow.

Conflict D: Incomplete keyspace for onboarding
- `src/i18n/strings.ts` has no onboarding key group.
- Result: onboarding text cannot be centrally managed, audited, or translated by same pipeline.

Intersection note: AI vs UI language
- AI language directive uses `getLang()` (`src/i18n/aiLanguage.ts:8`), but onboarding UI does not.
- Risk: UI and AI language diverge in the same session.

## 7. When and Why This Matters (Bug Surface)

Primary bug surface for your next work session:
- Any translation fix in onboarding done by editing component literals will not help other onboarding components.
- Any global language switch behavior test will fail consistency checks inside onboarding.

High probability regressions during onboarding text updates:
- Changing only `PromptCard` text may leave `LoginOverlay` and `Welcome1/2` unchanged.
- Adding keys only to `STRINGS` has zero effect unless onboarding components migrate from literals to `t(...)`.

## 8. System-Level Map (Single Source Candidates)

Current single source of truth:
- Language state: `src/i18n/lang.ts`
- Translation retrieval: `src/i18n/t.ts`

Current non-single-source zones:
- Onboarding content constants in:
  - `src/screens/Welcome1.tsx`
  - `src/screens/welcome2ManifestoText.ts`
  - `src/components/PromptCard.tsx`
  - `src/auth/LoginOverlay.tsx`

## 9. Forensic Conclusion

The onboarding stack currently sits outside the app's main i18n contract. Text in onboarding is fragmented across hardcoded literals and one local prop-based dictionary, while the rest of the app uses global `t(...)` keys and `getLang()`.

If your goal is bug-resistant translation work on onboarding, the critical point is this: onboarding text must be moved into the same keyspace and retrieval path as the rest of the app, otherwise every translation fix will remain partial and drift-prone.
