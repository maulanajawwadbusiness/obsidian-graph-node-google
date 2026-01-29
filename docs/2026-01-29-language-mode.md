# Language Mode Implementation Report

**Date**: 2026-01-29
**Status**: Implemented

## 1. The "One Knob" System
We have implemented a single source of truth for language selection, handled by `src/i18n/lang.ts`.

### Priority Order
1.  **Runtime Override**: `window.ARNVOID_LANG = 'id' | 'en'` (Immediate, triggers reload).
2.  **Persistence**: `localStorage.getItem('arnvoid_lang')`.
3.  **Environment**: `VITE_LANG` (Build-time default).
4.  **Fallback**: Defaults to `'id'` (Bahasa Indonesia).

### How to Switch
Open DevTools Console and run:
```javascript
// Switch to English
window.ARNVOID_LANG = 'en';
// or
import('./src/i18n/lang.ts').then(m => m.setLang('en'));
```
The app will reload to apply changes cleanly.

## 2. Core Modules
*   `src/i18n/strings.ts`: The central dictionary. Add new keys here. Flat keys like `"feature.subfeature"` are preferred.
*   `src/i18n/t.ts`: The translation helper. Usage: `t('key', { var: 'val' })`. Safe fallback to English.
*   `src/i18n/aiLanguage.ts`: Exports `getAiLanguageDirective()` for LLM prompting.

## 3. UI Migration
The following surfaces are fully localized:
*   **Node Popup**: Headers, tooltips, fallback content.
*   **Mini Chat**: Controls, tooltips.
*   **Full Chat**: "Jump to latest" button.
*   **Document Viewer**: Error messages and empty states.

## 4. AI Behavior Doctrine
All AI logic now injects a strict **Language Directive** into system prompts:

> **ID Mode**: "You MUST answer in Bahasa Indonesia. Use formal but fluid Indonesian suitable for deep reasoning..."
> **EN Mode**: "You MUST answer in English."

This applies to:
*   **Full Chat**: Deep reasoning responses.
*   **Prefill System**: Seed prompts ("Ceritakan lebih lanjut...") and Async refinement.
*   **Paper Analyzer**: Extracted point summaries.
*   **Label Rewriter**: Generated 3-word sentences.

## 5. Testing Checklist
1.  **ID Default**: Open app -> UI strings should be in Bahasa. Upload doc -> Analysis in Bahasa.
2.  **EN Switch**: Set `window.ARNVOID_LANG='en'` -> UI strings switch to English. Chat responses become English.
3.  **Mock Fallback**: Disconnect API key -> Fallback generic text matches selected language.
