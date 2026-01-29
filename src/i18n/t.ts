/**
 * Translation Helper
 * Zero-dependency t() function with variable interpolation.
 */

import { getLang } from './lang';
import { STRINGS } from './strings';

export type I18nKey = keyof typeof STRINGS['en'];

/**
 * Get translated string with optional variable interpolation.
 * @param key The key from strings.ts (e.g., 'nodePopup.header')
 * @param vars Record of variables to replace (e.g., { id: '123' })
 */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
    const lang = getLang();
    const dictionary = STRINGS[lang];

    // 1. Get raw string or fallback to English
    let text = dictionary[key] as string | undefined;

    if (!text && lang !== 'en') {
        // Fallback to English if missing in current lang
        text = STRINGS['en'][key];
    }

    if (!text) {
        // Absolute fallback if key missing everywhere
        return `[i18n-missing:${key}]`;
    }

    // 2. Interpolate variables {varName}
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replace(`{${k}}`, String(v));
        }
    }

    return text;
}
