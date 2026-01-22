/**
 * Search Session - Match computation and navigation
 * Precomputes all matches over canonical text for instant navigation
 */

export interface SearchMatch {
    start: number;
    end: number;
}

export interface SearchSession {
    query: string;
    matches: SearchMatch[];
    activeIndex: number;  // -1 if no active match
}

/**
 * Build search session by finding all matches in canonicalText.
 * Uses case-insensitive search. Returns matches sorted by start.
 */
export function createSearchSession(text: string, query: string): SearchSession {
    if (!query || query.trim() === '') {
        return { query: '', matches: [], activeIndex: -1 };
    }

    const matches: SearchMatch[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.trim().toLowerCase();
    let pos = 0;

    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        matches.push({ start: pos, end: pos + lowerQuery.length });
        pos += 1;  // Allow overlapping matches
    }

    console.log(`[Search] "${query}" → ${matches.length} matches`);

    return {
        query,
        matches,
        activeIndex: matches.length > 0 ? 0 : -1,
    };
}

/**
 * Navigate to next/previous match.
 * Wraps around at boundaries.
 */
export function navigateMatch(session: SearchSession, direction: 1 | -1): SearchSession {
    if (session.matches.length === 0) return session;

    const newIndex = (session.activeIndex + direction + session.matches.length) % session.matches.length;
    return { ...session, activeIndex: newIndex };
}

/**
 * Get the currently active match, if any
 */
export function getActiveMatch(session: SearchSession): SearchMatch | null {
    if (session.activeIndex === -1 || session.activeIndex >= session.matches.length) {
        return null;
    }
    return session.matches[session.activeIndex];
}
