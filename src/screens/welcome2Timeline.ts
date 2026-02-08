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

type WordSpan = {
    word: string;
    startIndex: number;
    endIndex: number;
    isHeavy: boolean;
};

type EmphasisAnalysis = {
    wordEndIsHeavyByIndex: Map<number, boolean>;
    landingAnchorIndices: Set<number>;
    heavyMatches: WordSpan[];
};

const DEBUG_WELCOME2_TIMELINE = false;
const MIN_LETTER_DIGIT_DELAY_MS = 20;
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

function analyzeEmphasis(
    renderText: string,
    semantic: CadenceConfig['semantic'] | undefined
): EmphasisAnalysis {
    const wordEndIsHeavyByIndex = new Map<number, boolean>();
    const landingAnchorIndices = new Set<number>();
    const heavyMatches: WordSpan[] = [];
    if (!semantic) {
        return {
            wordEndIsHeavyByIndex,
            landingAnchorIndices,
            heavyMatches,
        };
    }

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
            const word = renderText.slice(wordStart, wordEnd + 1);
            const wordLower = word.toLowerCase();
            const isHeavy = wordLength >= heavyWordMinLength || heavySet.has(wordLower);
            wordEndIsHeavyByIndex.set(wordEnd, isHeavy);
            if (isHeavy) {
                heavyMatches.push({
                    word,
                    startIndex: wordStart,
                    endIndex: wordEnd,
                    isHeavy,
                });
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
                    if (landingRank === 0) {
                        landingAnchorIndices.add(cursor);
                    }
                    landingRank += 1;
                }
                cursor -= 1;
            }
        }
    }

    return {
        wordEndIsHeavyByIndex,
        landingAnchorIndices,
        heavyMatches,
    };
}

function isDebugCadenceEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debugCadence') === '1';
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
    const emphasis = analyzeEmphasis(renderText, tunedCadence.semantic);
    const events: TimelineEvent[] = [];
    const charDeltaByIndex: number[] = new Array(renderChars.length).fill(0);
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
                const eventTimeMs = clampMs(currentTimeMs);
                events.push({
                    charIndex: i,
                    tMs: eventTimeMs,
                    char: '\n',
                    class: 'lineBreak',
                    pauseReason: 'lineBreak',
                    pauseAfterMs: 0,
                });
                currentTimeMs += singleNewlineSplit.postWaitMs;
                currentTimeMs = clampMs(currentTimeMs);
                charDeltaByIndex[i] = Math.max(0, currentTimeMs - eventTimeMs);
                continue;
            }

            // Double newline cluster:
            // split wait -> newline1 -> split wait, split wait -> newline2 -> split wait,
            // then paragraph semantic hold.
            currentTimeMs += doubleNewlineSplit.preWaitMs;
            const newline1TimeMs = clampMs(currentTimeMs);
            events.push({
                charIndex: i,
                tMs: newline1TimeMs,
                char: '\n',
                class: 'lineBreak',
                pauseReason: 'lineBreak',
                pauseAfterMs: 0,
            });
            currentTimeMs += doubleNewlineSplit.postWaitMs;
            const afterNewline1Ms = clampMs(currentTimeMs);
            charDeltaByIndex[i] = Math.max(0, afterNewline1Ms - newline1TimeMs);

            currentTimeMs += doubleNewlineSplit.preWaitMs;
            const paragraphPause = getParagraphPauseAfterDoubleNewline(
                i,
                renderChars,
                markerPauseByCharIndex,
                tunedCadence
            );
            const newline2TimeMs = clampMs(currentTimeMs);
            events.push({
                charIndex: i + 1,
                tMs: newline2TimeMs,
                char: '\n',
                class: 'lineBreak',
                pauseReason: paragraphPause.pauseReason,
                pauseAfterMs: clampMs(paragraphPause.pauseAfterMs),
            });
            currentTimeMs += doubleNewlineSplit.postWaitMs;

            currentTimeMs += paragraphPause.pauseAfterMs;
            currentTimeMs = clampMs(currentTimeMs);
            charDeltaByIndex[i + 1] = Math.max(0, currentTimeMs - newline2TimeMs);
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
            pauseAfterMs: 0,
        };
        let semanticPauseAfterMs = 0;
        const semantic = tunedCadence.semantic;
        if (semantic) {
            const isWordEnd = isWordChar(char) && (i + 1 >= renderChars.length || !isWordChar(renderChars[i + 1]));
            if (isWordEnd) {
                semanticPauseAfterMs += clampMs(semantic.wordEndPauseMs);
                if (emphasis.wordEndIsHeavyByIndex.get(i)) {
                    semanticPauseAfterMs += clampMs(semantic.heavyWordEndExtraPauseMs);
                }
            }
            if (emphasis.landingAnchorIndices.has(i)) {
                semanticPauseAfterMs += clampMs(semantic.sentenceLandingExtraPauseMs);
            }
        }
        event.pauseAfterMs = clampMs(pause.pauseAfterMs + semanticPauseAfterMs);
        events.push(event);

        let charDelayMs = getCostBetweenChars(charClass, tunedCadence);
        if (charClass === 'letter' || charClass === 'digit') {
            charDelayMs = Math.max(MIN_LETTER_DIGIT_DELAY_MS, clampMs(charDelayMs));
        }

        const eventTimeMs = event.tMs;
        currentTimeMs += charDelayMs;
        currentTimeMs += event.pauseAfterMs;
        currentTimeMs = clampMs(currentTimeMs);
        charDeltaByIndex[i] = Math.max(0, currentTimeMs - eventTimeMs);
    }

    if (isDebugCadenceEnabled()) {
        const semantic = tunedCadence.semantic;
        console.log(
            '[Welcome2Cadence] cadence base=%d space=%d comma=%d period=%d question=%d newline=%d paragraph=%d markerDefault=%d endHold=%d',
            tunedCadence.baseCharMs,
            tunedCadence.spaceMs,
            tunedCadence.commaPauseMs,
            tunedCadence.periodPauseMs,
            tunedCadence.questionPauseMs,
            tunedCadence.newlinePauseMs,
            tunedCadence.paragraphPauseMs,
            tunedCadence.markerPauseDefaultMs,
            tunedCadence.endHoldMs
        );
        if (semantic) {
            console.log(
                '[Welcome2Cadence] semantic heavyWordMinLength=%d wordEndPauseMs=%d heavyWordEndExtraPauseMs=%d landingTailChars=%d sentenceLandingExtraPauseMs=%d heavyWords=%s',
                semantic.heavyWordMinLength,
                semantic.wordEndPauseMs,
                semantic.heavyWordEndExtraPauseMs,
                semantic.landingTailChars,
                semantic.sentenceLandingExtraPauseMs,
                JSON.stringify(semantic.heavyWords)
            );
        } else {
            console.log('[Welcome2Cadence] semantic disabled');
        }

        console.log('[Welcome2Cadence] heavy matches count=%d', emphasis.heavyMatches.length);
        const heavySamples = emphasis.heavyMatches.slice(0, 3);
        heavySamples.forEach((sample, sampleIndex) => {
            console.log(
                '[Welcome2Cadence] heavy sample %d word=%s start=%d end=%d',
                sampleIndex + 1,
                sample.word,
                sample.startIndex,
                sample.endIndex
            );
        });

        if (emphasis.heavyMatches.length > 0) {
            const firstHeavy = emphasis.heavyMatches[0];
            const from = Math.max(0, firstHeavy.startIndex - 6);
            const to = Math.min(renderChars.length - 1, firstHeavy.endIndex + 5);
            const timingSample: Array<{ charIndex: number; char: string; deltaMs: number }> = [];
            for (let idx = from; idx <= to; idx += 1) {
                timingSample.push({
                    charIndex: idx,
                    char: renderChars[idx],
                    deltaMs: charDeltaByIndex[idx] ?? 0,
                });
            }
            console.log('[Welcome2Cadence] timing sample around first heavy word:', timingSample);
        } else {
            console.log('[Welcome2Cadence] timing sample skipped no heavy words detected');
        }
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
