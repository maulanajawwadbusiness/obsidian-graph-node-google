import { DEFAULT_CADENCE, type CadenceConfig, applySpeed } from '../config/onboardingCadence';
import { MANIFESTO_TEXT } from './welcome2ManifestoText';

export type TimelineCharClass = 'letter' | 'digit' | 'space' | 'punct' | 'lineBreak';

export type PauseReason =
    | 'base'
    | 'space'
    | 'comma'
    | 'period'
    | 'question'
    | 'lineBreak'
    | 'paragraph'
    | 'marker';

export type TimelineEvent = {
    charIndex: number;
    tMs: number;
    char: string;
    class: TimelineCharClass;
    pauseReason: PauseReason;
    pauseAfterMs: number;
};

export type BuiltTimeline = {
    rawText: string;
    renderText: string;
    events: TimelineEvent[];
    totalMs: number;
};

type MarkerParse = {
    nextIndex: number;
    pauseMs: number;
    malformed: boolean;
};

const DEBUG_WELCOME2_TIMELINE = false;

function clampMs(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
}

function parsePauseMarkerAt(rawText: string, startIndex: number, fallbackMs: number): MarkerParse | null {
    if (rawText[startIndex] !== '{') return null;
    const endIndex = rawText.indexOf('}', startIndex + 1);
    if (endIndex < 0) return null;

    const body = rawText.slice(startIndex + 1, endIndex).trim();
    if (!/^[pP]/.test(body)) {
        return null;
    }

    const match = /^p\s*=\s*(\d+)\s*$/i.exec(body);
    if (!match) {
        return {
            nextIndex: endIndex + 1,
            pauseMs: clampMs(fallbackMs),
            malformed: true,
        };
    }

    return {
        nextIndex: endIndex + 1,
        pauseMs: clampMs(Number(match[1])),
        malformed: false,
    };
}

function buildRenderAndMarkerMap(
    rawText: string,
    markerPauseDefaultMs: number
): {
    renderChars: string[];
    markerPauseByCharIndex: Array<number | undefined>;
    malformedMarkerFound: boolean;
} {
    const renderChars: string[] = [];
    const markerPauseByCharIndex: Array<number | undefined> = [];
    let malformedMarkerFound = false;
    let rawIndex = 0;

    while (rawIndex < rawText.length) {
        const marker = parsePauseMarkerAt(rawText, rawIndex, markerPauseDefaultMs);
        if (marker) {
            if (renderChars.length > 0) {
                markerPauseByCharIndex[renderChars.length - 1] = marker.pauseMs;
            }
            malformedMarkerFound = malformedMarkerFound || marker.malformed;
            rawIndex = marker.nextIndex;
            continue;
        }

        renderChars.push(rawText[rawIndex]);
        rawIndex += 1;
    }

    return {
        renderChars,
        markerPauseByCharIndex,
        malformedMarkerFound,
    };
}

export function classifyChar(char: string): TimelineCharClass {
    if (char === '\n') return 'lineBreak';
    if (char === ' ') return 'space';
    if (/[0-9]/.test(char)) return 'digit';
    if (/[A-Za-z]/.test(char)) return 'letter';
    return 'punct';
}

function getCostBetweenChars(charClass: TimelineCharClass, cadence: CadenceConfig): number {
    if (charClass === 'space') return cadence.spaceMs;
    if (charClass === 'lineBreak') return 0;
    return cadence.baseCharMs;
}

function getPauseForChar(
    char: string,
    charIndex: number,
    renderChars: string[],
    markerPauseByCharIndex: Array<number | undefined>,
    cadence: CadenceConfig
): { pauseReason: PauseReason; pauseAfterMs: number } {
    const markerPause = markerPauseByCharIndex[charIndex];
    if (markerPause !== undefined) {
        return {
            pauseReason: 'marker',
            pauseAfterMs: markerPause,
        };
    }

    if (char === ',') {
        return { pauseReason: 'comma', pauseAfterMs: cadence.commaPauseMs };
    }
    if (char === '.') {
        return { pauseReason: 'period', pauseAfterMs: cadence.periodPauseMs };
    }
    if (char === '?') {
        return { pauseReason: 'question', pauseAfterMs: cadence.questionPauseMs };
    }
    if (char === '\n') {
        const isSecondNewline = charIndex > 0 && renderChars[charIndex - 1] === '\n';
        const isFirstInParagraphPair = charIndex + 1 < renderChars.length && renderChars[charIndex + 1] === '\n';
        if (isSecondNewline) {
            const preParagraphIndex = charIndex - 2;
            const hadMarkerBeforeParagraph =
                preParagraphIndex >= 0 && markerPauseByCharIndex[preParagraphIndex] !== undefined;
            if (hadMarkerBeforeParagraph) {
                return { pauseReason: 'lineBreak', pauseAfterMs: 0 };
            }
            return { pauseReason: 'paragraph', pauseAfterMs: cadence.paragraphPauseMs };
        }
        if (isFirstInParagraphPair) {
            return { pauseReason: 'lineBreak', pauseAfterMs: 0 };
        }
        return { pauseReason: 'lineBreak', pauseAfterMs: cadence.newlinePauseMs };
    }

    if (char === ' ') {
        return { pauseReason: 'space', pauseAfterMs: 0 };
    }

    return { pauseReason: 'base', pauseAfterMs: 0 };
}

export function buildWelcome2Timeline(rawText: string, cadence: CadenceConfig = DEFAULT_CADENCE): BuiltTimeline {
    const tunedCadence = applySpeed(cadence, 1.0);
    const markerDefaultMs = clampMs(tunedCadence.markerPauseDefaultMs);
    const { renderChars, markerPauseByCharIndex, malformedMarkerFound } = buildRenderAndMarkerMap(rawText, markerDefaultMs);

    if (malformedMarkerFound) {
        console.warn('[Welcome2Type] malformed pause marker; using markerPauseDefaultMs');
    }

    const renderText = renderChars.join('');
    const events: TimelineEvent[] = [];
    let currentTimeMs = 0;

    for (let i = 0; i < renderChars.length; i += 1) {
        const char = renderChars[i];
        const charClass = classifyChar(char);
        const { pauseReason, pauseAfterMs } = getPauseForChar(
            char,
            i,
            renderChars,
            markerPauseByCharIndex,
            tunedCadence
        );

        const event: TimelineEvent = {
            charIndex: i,
            tMs: clampMs(currentTimeMs),
            char,
            class: charClass,
            pauseReason,
            pauseAfterMs: clampMs(pauseAfterMs),
        };
        events.push(event);

        currentTimeMs += getCostBetweenChars(charClass, tunedCadence);
        currentTimeMs += event.pauseAfterMs;
        currentTimeMs = clampMs(currentTimeMs);
    }

    return {
        rawText,
        renderText,
        events,
        totalMs: clampMs(currentTimeMs + tunedCadence.endHoldMs),
    };
}

export function debugWelcome2TimelineBuild(): BuiltTimeline {
    const built = buildWelcome2Timeline(MANIFESTO_TEXT, DEFAULT_CADENCE);
    if (!DEBUG_WELCOME2_TIMELINE) {
        return built;
    }

    const markerCount = built.events.filter((event) => event.pauseReason === 'marker').length;
    console.log('[Welcome2Type] renderText length:', built.renderText.length);
    console.log('[Welcome2Type] first 10 events:', built.events.slice(0, 10));
    console.log('[Welcome2Type] last 5 events:', built.events.slice(-5));
    console.log('[Welcome2Type] totalMs:', built.totalMs);
    console.log('[Welcome2Type] marker pauses applied:', markerCount);
    return built;
}
