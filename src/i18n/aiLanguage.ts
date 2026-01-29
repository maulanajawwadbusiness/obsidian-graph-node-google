/**
 * AI Language Directives
 * Enforces output language selection for LLMs.
 */

import { getLang } from './lang';

export function getAiLanguageDirective(): string {
    const lang = getLang();

    if (lang === 'id') {
        return `LANGUAGE DIRECTIVE: You MUST answer in Bahasa Indonesia. Use formal but fluid Indonesian suitable for deep reasoning. Avoid English unless the user explicitly requests it or the term is a technical standard better kept in English.`;
    }

    // Default / English
    return `LANGUAGE DIRECTIVE: You MUST answer in English.`;
}
