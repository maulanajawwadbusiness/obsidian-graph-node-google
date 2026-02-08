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

type EmphasisMeta = {
    heavyDistanceFromEnd?: number;
    landingRank?: number;
};

const DEBUG_WELCOME2_TIMELINE = false;
const NEWLINE_POST_MIN_MS = 40;
const NEWLINE_POST_MAX_FRACTION = 0.2;
const NEWLINE_PREWAIT_MULTIPLIER = 2.5;
const DOUBLE_NEWLINE_MECHANICAL_MULTIPLIER = 1.5;

function clampMs(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
}

function splitNewlinePause(newlinePauseMs: number): { preWaitMs: number; postWaitMs: number } {
    const totalMs = clampMs(newlinePauseMs);
    const postFromFractionMs = Math.floor(totalMs * NEWLINE_POST_MAX_FRACTION);
    const postWaitMs = Math.min(NEWLINE_POST_MIN_MS, postFromFractionMs);
    const basePreWaitMs = Math.max(0, totalMs - postWaitMs);
    const preWaitMs = clampMs(basePreWaitMs * NEWLINE_PREWAIT_MULTIPLIER);
    return {
        preWaitMs,
        postWaitMs,
    };
}

function isWordChar(char: string): boolean {
    return /[A-Za-z0-9]/.test(char);
}

function mergeEmphasisMeta(result: Map<number, EmphasisMeta>, index: number, next: EmphasisMeta): void {
    const prev = result.get(index);
    if (!prev) {
        result.set(index, next);
        return;
    }

    const merged: EmphasisMeta = {
        heavyDistanceFromEnd: prev.heavyDistanceFromEnd,
        landingRank: prev.landingRank,
    };

    if (typeof next.heavyDistanceFromEnd === 'number') {
        if (
            typeof merged.heavyDistanceFromEnd !== 'number' ||
            next.heavyDistanceFromEnd < merged.heavyDistanceFromEnd
        ) {
            merged.heavyDistanceFromEnd = next.heavyDistanceFromEnd;
        }
    }

    if (typeof next.landingRank === 'number') {
        if (typeof merged.landingRank !== 'number' || next.landingRank < merged.landingRank) {
            merged.landingRank = next.landingRank;
        }
    }

    result.set(index, merged);
}

function analyzeEmphasis(
    renderText: string,
    semantic: CadenceConfig['semantic'] | undefined
): Map<number, EmphasisMeta> {
    const result = new Map<number, EmphasisMeta>();
    if (!semantic) return result;

    const heavyWordTailChars = Math.max(0, Math.floor(semantic.heavyWordTailChars));
    const landingTailChars = Math.max(0, Math.floor(semantic.landingTailChars));
    const heavyWordMinLength = Math.max(1, Math.floor(semantic.heavyWordMinLength));
    const heavySet = new Set((semantic.heavyWords ?? []).map((word) => word.toLowerCase()));

    let wordStart = -1;
    for (let i = 0; i <= renderText.length; i += 1) {
        const char = i < renderText.length ? renderText[i] : '';
        if (i < renderText.length && isWordChar(char)) {
            if (wordStart < 0) wordStart = i;
            continue;
        }

        if (wordStart >= 0) {
            const wordEnd = i - 1;
            const wordLength = wordEnd - wordStart + 1;
            const wordLower = renderText.slice(wordStart, wordEnd + 1).toLowerCase();
            const isHeavy = wordLength >= heavyWordMinLength || heavySet.has(wordLower);
            if (isHeavy && heavyWordTailChars > 0) {
                const tailCount = Math.min(heavyWordTailChars, wordLength);
                for (let distance = 0; distance < tailCount; distance += 1) {
                    const index = wordEnd - distance;
                    mergeEmphasisMeta(result, index, { heavyDistanceFromEnd: distance });
                }
            }
            wordStart = -1;
        }
    }

    if (landingTailChars > 0) {
        for (let i = 0; i < renderText.length; i += 1) {
            const char = renderText[i];
            if (char !== '.' && char !== '?') continue;

            let cursor = i - 1;
            let landingRank = 0;
            while (cursor >= 0 && landingRank < landingTailChars) {
                const candidate = renderText[cursor];
                if (candidate !== ' ' && candidate !== '\n') {
                    mergeEmphasisMeta(result, cursor, { landingRank });
                    landingRank += 1;
                }
                cursor -= 1;
            }
        }
    }

    return result;
}

function getSemanticMultiplier(
    meta: EmphasisMeta | undefined,
    semantic: CadenceConfig['semantic'] | undefined
): number {
    if (!meta || !semantic) return 1.0;

    let multiplier = 1.0;

    if (typeof meta.heavyDistanceFromEnd === 'number') {
        if (meta.heavyDistanceFromEnd === 0) multiplier *= 1.5;
        else if (meta.heavyDistanceFromEnd === 1) multiplier *= 1.3;
        else if (meta.heavyDistanceFromEnd === 2) multiplier *= 1.15;
    }

    if (typeof meta.landingRank === 'number') {
        if (meta.landingRank === 0) multiplier *= 1.4;
        else if (meta.landingRank === 1) multiplier *= 1.2;
        else if (meta.landingRank === 2) multiplier *= 1.1;
    }

    const maxHeavy = semantic.heavyWordMaxMultiplier || 1.5;
    const maxLanding = semantic.landingMaxMultiplier || 1.4;
    const globalMax = Math.min(maxHeavy * maxLanding, 1.9);
    return Math.min(multiplier, globalMax);
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
    if (char === ' ') {
        return { pauseReason: 'space', pauseAfterMs: 0 };
    }

    return { pauseReason: 'base', pauseAfterMs: 0 };
}

function findLastPrintableIndexBefore(renderChars: string[], index: number): number {
    for (let i = index - 1; i >= 0; i -= 1) {
        if (renderChars[i] !== '\n') {
            return i;
        }
    }
    return -1;
}

function getParagraphPauseAfterDoubleNewline(
    firstNewlineIndex: number,
    renderChars: string[],
    markerPauseByCharIndex: Array<number | undefined>,
    cadence: CadenceConfig
): { pauseReason: PauseReason; pauseAfterMs: number } {
    const lastPrintableIndex = findLastPrintableIndexBefore(renderChars, firstNewlineIndex);
    const markerPauseMs = lastPrintableIndex >= 0 ? (markerPauseByCharIndex[lastPrintableIndex] ?? 0) : 0;
    const effectiveParagraphPauseMs = Math.max(markerPauseMs, cadence.paragraphPauseMs);

    // Marker pause already happened on the prior printable char.
    // Attach only the remainder after newline2 to avoid semantic double-stack.
    const paragraphExtraAfterNewline2 = Math.max(0, effectiveParagraphPauseMs - markerPauseMs);
    if (paragraphExtraAfterNewline2 <= 0) {
        return { pauseReason: 'lineBreak', pauseAfterMs: 0 };
    }
    return { pauseReason: 'paragraph', pauseAfterMs: paragraphExtraAfterNewline2 };
}

export function buildWelcome2Timeline(rawText: string, cadence: CadenceConfig = DEFAULT_CADENCE): BuiltTimeline {
    const tunedCadence = applySpeed(cadence, 1.0);
    const markerDefaultMs = clampMs(tunedCadence.markerPauseDefaultMs);
    const { renderChars, markerPauseByCharIndex, malformedMarkerFound } = buildRenderAndMarkerMap(rawText, markerDefaultMs);

    if (malformedMarkerFound) {
        console.warn('[Welcome2Type] malformed pause marker; using markerPauseDefaultMs');
    }

    const renderText = renderChars.join('');
    const emphasisByCharIndex = analyzeEmphasis(renderText, tunedCadence.semantic);
    const events: TimelineEvent[] = [];
    let currentTimeMs = 0;

    for (let i = 0; i < renderChars.length; i += 1) {
        const char = renderChars[i];
        const charClass = classifyChar(char);

        if (charClass === 'lineBreak') {
            const hasSecondNewline = i + 1 < renderChars.length && renderChars[i + 1] === '\n';
            const singleNewlineSplit = splitNewlinePause(tunedCadence.newlinePauseMs);
            const doubleNewlineTotalPauseMs = Math.floor(tunedCadence.newlinePauseMs * DOUBLE_NEWLINE_MECHANICAL_MULTIPLIER);
            const doubleNewlineSplit = splitNewlinePause(doubleNewlineTotalPauseMs);

            if (!hasSecondNewline) {
                // Single newline: split wait around the drop.
                currentTimeMs += singleNewlineSplit.preWaitMs;
                events.push({
                    charIndex: i,
                    tMs: clampMs(currentTimeMs),
                    char: '\n',
                    class: 'lineBreak',
                    pauseReason: 'lineBreak',
                    pauseAfterMs: 0,
                });
                currentTimeMs += singleNewlineSplit.postWaitMs;
                currentTimeMs = clampMs(currentTimeMs);
                continue;
            }

            // Double newline cluster:
            // split wait -> newline1 -> split wait, split wait -> newline2 -> split wait,
            // then paragraph semantic hold.
            currentTimeMs += doubleNewlineSplit.preWaitMs;
            events.push({
                charIndex: i,
                tMs: clampMs(currentTimeMs),
                char: '\n',
                class: 'lineBreak',
                pauseReason: 'lineBreak',
                pauseAfterMs: 0,
            });
            currentTimeMs += doubleNewlineSplit.postWaitMs;

            currentTimeMs += doubleNewlineSplit.preWaitMs;
            const paragraphPause = getParagraphPauseAfterDoubleNewline(
                i,
                renderChars,
                markerPauseByCharIndex,
                tunedCadence
            );
            events.push({
                charIndex: i + 1,
                tMs: clampMs(currentTimeMs),
                char: '\n',
                class: 'lineBreak',
                pauseReason: paragraphPause.pauseReason,
                pauseAfterMs: clampMs(paragraphPause.pauseAfterMs),
            });
            currentTimeMs += doubleNewlineSplit.postWaitMs;

            currentTimeMs += paragraphPause.pauseAfterMs;
            currentTimeMs = clampMs(currentTimeMs);
            i += 1;
            continue;
        }

        const pause = getPauseForChar(
            char,
            i,
            markerPauseByCharIndex,
            tunedCadence
        );

        const event: TimelineEvent = {
            charIndex: i,
            tMs: clampMs(currentTimeMs),
            char,
            class: charClass,
            pauseReason: pause.pauseReason,
            pauseAfterMs: clampMs(pause.pauseAfterMs),
        };
        events.push(event);

        let charDelayMs = getCostBetweenChars(charClass, tunedCadence);
        if (charClass === 'letter' || charClass === 'digit') {
            const semanticMultiplier = getSemanticMultiplier(emphasisByCharIndex.get(i), tunedCadence.semantic);
            charDelayMs = clampMs(charDelayMs * semanticMultiplier);
        }

        currentTimeMs += charDelayMs;
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
