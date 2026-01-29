/**
 * Language State Management (Zero Dependency)
 * Priority: Window Override -> LocalStorage -> Env -> Default ID
 */

export type Lang = 'id' | 'en';

declare global {
    interface Window {
        ARNVOID_LANG?: Lang;
    }
}

const STORAGE_KEY = 'arnvoid_lang';
const FALLBACK_LANG: Lang = 'id'; // As requested, ID is default if nothing else set

export function getLang(): Lang {
    // 1. Window override (Dev console runtime switch)
    if (typeof window !== 'undefined' && window.ARNVOID_LANG) {
        return window.ARNVOID_LANG;
    }

    // 2. LocalStorage persistence
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'id' || stored === 'en') {
            return stored as Lang;
        }
    }

    // 3. Env Variable (Build time default)
    const envLang = import.meta.env.VITE_LANG;
    if (envLang === 'id' || envLang === 'en') {
        return envLang as Lang;
    }

    // 4. Fallback
    return FALLBACK_LANG;
}

export function setLang(lang: Lang) {
    if (typeof window === 'undefined') return;

    // Updates local storage for persistence
    localStorage.setItem(STORAGE_KEY, lang);

    // Updates runtime override if present (to sync state)
    window.ARNVOID_LANG = lang;

    console.log(`[i18n] Language set to: ${lang}`);
    window.location.reload(); // Simple reload to apply all changes smoothly
}
