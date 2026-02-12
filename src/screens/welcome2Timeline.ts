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
    landingTailByPunctuationIndex: Map<number, number[]>;
    heavyMatches: WordSpan[];
};

const DEBUG_WELCOME2_TIMELINE = false;
const MIN_LETTER_DIGIT_DELAY_MS = 20;
const NEWLINE_POST_MIN_MS = 40;
const NEWLINE_POST_MAX_FRACTION = 0.2;
const NEWLINE_PREWAIT_MULTIPLIER = 2.5;
const DOUBLE_NEWLINE_MECHANICAL_MULTIPLIER = 1.5;
const MAX_SEMANTIC_BOUNDARY_MS = 220;

type SemanticBoundaryCategory = 'none' | 'word' | 'heavyWord' | 'landing' | 'marker' | 'newline' | 'paragraph';

type SemanticSourceFlags = {
    word: boolean;
    heavyWord: boolean;
    landing: boolean;
    marker: boolean;
};

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
    const landingTailByPunctuationIndex = new Map<number, number[]>();
    const heavyMatches: WordSpan[] = [];
    if (!semantic) {
        return {
            wordEndIsHeavyByIndex,
            landingTailByPunctuationIndex,
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
            if (char !== '.' && char !== '?' && char !== '!') continue;

            let cursor = i - 1;
            let landingRank = 0;
            const indices: number[] = [];
            while (cursor >= 0 && landingRank < landingTailChars) {
                const candidate = renderText[cursor];
                if (candidate !== ' ' && candidate !== '\n') {
                    indices.push(cursor);
                    landingRank += 1;
                }
                cursor -= 1;
            }
            if (indices.length > 0) {
                landingTailByPunctuationIndex.set(i, indices);
            }
        }
    }

    return {
        wordEndIsHeavyByIndex,
        landingTailByPunctuationIndex,
        heavyMatches,
    };
}

function isBoundaryChar(ch: string): boolean {
    return (
        ch === ' ' ||
        ch === '\n' ||
        ch === '.' ||
        ch === '?' ||
        ch === '!' ||
        ch === ',' ||
        ch === ';' ||
        ch === ':'
    );
}

function buildNextBoundaryIndex(renderChars: string[]): number[] {
    const len = renderChars.length;
    const nextBoundaryIndex = new Array<number>(len).fill(-1);
    let lastBoundary = -1;

    for (let i = len - 1; i >= 0; i -= 1) {
        const ch = renderChars[i];
        if (isBoundaryChar(ch)) {
            lastBoundary = i;
        }
        nextBoundaryIndex[i] = lastBoundary;
    }

    return nextBoundaryIndex;
}

function isDebugCadenceEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debugCadence') === '1';
}

function summarizeMs(values: number[]): { count: number; min: number; p50: number; p95: number; max: number } {
    if (values.length === 0) {
        return { count: 0, min: 0, p50: 0, p95: 0, max: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const pick = (q: number): number => {
        const idx = Math.floor((sorted.length - 1) * q);
        return sorted[idx];
    };
    return {
        count: sorted.length,
        min: sorted[0],
        p50: pick(0.5),
        p95: pick(0.95),
        max: sorted[sorted.length - 1],
    };
}

function makeSemanticSourceFlags(): SemanticSourceFlags {
    return {
        word: false,
        heavyWord: false,
        landing: false,
        marker: false,
    };
}

function countSemanticSourceFlags(flags: SemanticSourceFlags): number {
    let count = 0;
    if (flags.word) count += 1;
    if (flags.heavyWord) count += 1;
    if (flags.landing) count += 1;
    if (flags.marker) count += 1;
    return count;
}

function resolveSemanticCategory(flags: SemanticSourceFlags): SemanticBoundaryCategory {
    // Priority ladder: marker > landing > heavyWord > word > none.
    if (flags.marker) return 'marker';
    if (flags.landing) return 'landing';
    if (flags.heavyWord) return 'heavyWord';
    if (flags.word) return 'word';
    return 'none';
}

function getSemanticPauseForCategory(
    category: SemanticBoundaryCategory,
    wordEndPauseMs: number,
    heavyWordEndExtraPauseMs: number,
    sentenceLandingExtraPauseMs: number
): number {
    if (category === 'marker') return 0;
    if (category === 'landing') return sentenceLandingExtraPauseMs;
    if (category === 'heavyWord') return wordEndPauseMs + heavyWordEndExtraPauseMs;
    if (category === 'word') return wordEndPauseMs;
    return 0;
}

function getDebugTextSlice(renderChars: string[], centerIndex: number, radius: number = 16): string {
    const from = Math.max(0, centerIndex - radius);
    const to = Math.min(renderChars.length - 1, centerIndex + radius);
    return renderChars.slice(from, to + 1).join('');
}

function assembleSemanticBoundaryPauses(
    renderChars: string[],
    markerPauseByCharIndex: Array<number | undefined>,
    nextBoundaryIndex: number[],
    emphasis: EmphasisAnalysis,
    semantic: CadenceConfig['semantic'] | undefined,
    debugEnabled: boolean,
    debugLabel: string
): {
    semanticPauseByIndex: number[];
    semanticCategoryByIndex: SemanticBoundaryCategory[];
    semanticSourceFlagsByIndex: SemanticSourceFlags[];
} {
    const semanticPauseByIndex: number[] = new Array(renderChars.length).fill(0);
    const semanticCategoryByIndex: SemanticBoundaryCategory[] = new Array(renderChars.length).fill('none');
    const semanticSourceFlagsByIndex: SemanticSourceFlags[] = new Array(renderChars.length)
        .fill(null)
        .map(() => makeSemanticSourceFlags());

    if (!semantic) {
        return {
            semanticPauseByIndex,
            semanticCategoryByIndex,
            semanticSourceFlagsByIndex,
        };
    }

    const wordEndPauseMs = clampMs(semantic.wordEndPauseMs);
    const heavyWordEndExtraPauseMs = clampMs(semantic.heavyWordEndExtraPauseMs);
    const sentenceLandingExtraPauseMs = clampMs(semantic.sentenceLandingExtraPauseMs);
    const boundaryIndices = new Set<number>();

    for (let i = 0; i < renderChars.length; i += 1) {
        const char = renderChars[i];
        if (!isWordChar(char)) continue;
        const isWordEnd = i + 1 >= renderChars.length || !isWordChar(renderChars[i + 1]);
        if (!isWordEnd) continue;

        const boundaryIndex = nextBoundaryIndex[i];
        const finalBoundaryIndex = boundaryIndex >= 0 ? boundaryIndex : renderChars.length - 1;
        if (finalBoundaryIndex < 0) continue;

        const flags = semanticSourceFlagsByIndex[finalBoundaryIndex];
        flags.word = true;
        if (emphasis.wordEndIsHeavyByIndex.get(i) === true) {
            flags.heavyWord = true;
        }
        boundaryIndices.add(finalBoundaryIndex);
    }

    if (sentenceLandingExtraPauseMs > 0) {
        for (const punctuationIndex of emphasis.landingTailByPunctuationIndex.keys()) {
            if (punctuationIndex < 0 || punctuationIndex >= renderChars.length) continue;
            semanticSourceFlagsByIndex[punctuationIndex].landing = true;
            boundaryIndices.add(punctuationIndex);
        }
    }

    for (let i = 0; i < markerPauseByCharIndex.length; i += 1) {
        if (markerPauseByCharIndex[i] === undefined) continue;
        semanticSourceFlagsByIndex[i].marker = true;
        boundaryIndices.add(i);
    }

    for (const boundaryIndex of boundaryIndices.values()) {
        const flags = semanticSourceFlagsByIndex[boundaryIndex];
        const sourceCount = countSemanticSourceFlags(flags);
        const category = resolveSemanticCategory(flags);
        const semanticPauseMs = Math.min(
            clampMs(
                getSemanticPauseForCategory(
                    category,
                    wordEndPauseMs,
                    heavyWordEndExtraPauseMs,
                    sentenceLandingExtraPauseMs
                )
            ),
            MAX_SEMANTIC_BOUNDARY_MS
        );

        semanticCategoryByIndex[boundaryIndex] = category;
        semanticPauseByIndex[boundaryIndex] = semanticPauseMs;

        if (debugEnabled && sourceCount > 1) {
            console.log(
                '[Welcome2Cadence][SemanticConflict] label=%s index=%d char=%s flags=%o resolvedCategory=%s semanticPauseMs=%d textSlice=%s',
                debugLabel,
                boundaryIndex,
                JSON.stringify(renderChars[boundaryIndex] ?? ''),
                flags,
                category,
                semanticPauseMs,
                JSON.stringify(getDebugTextSlice(renderChars, boundaryIndex))
            );
        }
    }

    return {
        semanticPauseByIndex,
        semanticCategoryByIndex,
        semanticSourceFlagsByIndex,
    };
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
    // Letters, digits, and punctuation share one stable base cadence bucket.
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
    const debugCadenceEnabled = isDebugCadenceEnabled();
    const markerDefaultMs = clampMs(tunedCadence.markerPauseDefaultMs);
    const { renderChars, markerPauseByCharIndex, malformedMarkerFound } = buildRenderAndMarkerMap(rawText, markerDefaultMs);
    const nextBoundaryIndex = buildNextBoundaryIndex(renderChars);

    if (malformedMarkerFound) {
        console.warn('[Welcome2Type] malformed pause marker; using markerPauseDefaultMs');
    }

    const renderText = renderChars.join('');
    const emphasis = analyzeEmphasis(renderText, tunedCadence.semantic);
    const events: TimelineEvent[] = [];
    const charDeltaByIndex: number[] = new Array(renderChars.length).fill(0);
    const charDelayByIndex: number[] = new Array(renderChars.length).fill(0);
    const semanticAssembly = assembleSemanticBoundaryPauses(
        renderChars,
        markerPauseByCharIndex,
        nextBoundaryIndex,
        emphasis,
        tunedCadence.semantic,
        debugCadenceEnabled,
        'manifesto'
    );
    const semanticPauseByIndex = semanticAssembly.semanticPauseByIndex;
    const semanticCategoryByIndex = semanticAssembly.semanticCategoryByIndex;
    const semanticSourceFlagsByIndex = semanticAssembly.semanticSourceFlagsByIndex;
    const expectedLetterDelay = Math.max(MIN_LETTER_DIGIT_DELAY_MS, clampMs(tunedCadence.baseCharMs));
    const expectedSpaceDelay = clampMs(tunedCadence.spaceMs);
    const expectedPunctDelay = clampMs(tunedCadence.baseCharMs);
    let currentTimeMs = 0;
    // Invariant: semantic cadence is boundary-only. Letters are mechanically timed only.

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
                if (semanticCategoryByIndex[i] === 'none') {
                    semanticCategoryByIndex[i] = 'newline';
                }
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
            if (semanticCategoryByIndex[i] === 'none') {
                semanticCategoryByIndex[i] = 'newline';
            }
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
            if (semanticCategoryByIndex[i + 1] === 'none') {
                semanticCategoryByIndex[i + 1] = 'paragraph';
            }
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
        semanticPauseAfterMs += semanticPauseByIndex[i] ?? 0;
        event.pauseAfterMs = clampMs(pause.pauseAfterMs + semanticPauseAfterMs);
        events.push(event);

        let charDelayMs = expectedPunctDelay;
        if (charClass === 'letter' || charClass === 'digit') {
            charDelayMs = expectedLetterDelay;
        } else if (charClass === 'space') {
            charDelayMs = expectedSpaceDelay;
        } else {
            charDelayMs = clampMs(getCostBetweenChars(charClass, tunedCadence));
        }
        // Invariant: charDelayMs is mechanical-only. Semantic timing flows via pauseAfterMs on boundaries.
        charDelayByIndex[i] = clampMs(charDelayMs);

        const eventTimeMs = event.tMs;
        currentTimeMs += charDelayMs;
        currentTimeMs += event.pauseAfterMs;
        currentTimeMs = clampMs(currentTimeMs);
        charDeltaByIndex[i] = Math.max(0, currentTimeMs - eventTimeMs);
    }

    for (let i = 0; i < renderChars.length; i += 1) {
        const semanticPauseMs = semanticPauseByIndex[i] ?? 0;
        if (semanticPauseMs > MAX_SEMANTIC_BOUNDARY_MS) {
            console.log(
                '[Welcome2Cadence][Violation] semantic pause exceeded clamp index=%d semanticPauseMs=%d max=%d',
                i,
                semanticPauseMs,
                MAX_SEMANTIC_BOUNDARY_MS
            );
        }
        const flags = semanticSourceFlagsByIndex[i];
        const sourceCount = countSemanticSourceFlags(flags);
        if (debugCadenceEnabled && sourceCount > 1) {
            console.log(
                '[Welcome2Cadence][Violation] multiple semantic sources index=%d char=%s flags=%o resolvedCategory=%s',
                i,
                JSON.stringify(renderChars[i] ?? ''),
                flags,
                semanticCategoryByIndex[i] ?? 'none'
            );
        }
        if ((semanticCategoryByIndex[i] ?? 'none') === 'marker' && semanticPauseMs !== 0) {
            console.log(
                '[Welcome2Cadence][Violation] marker boundary must suppress semantic index=%d semanticPauseMs=%d',
                i,
                semanticPauseMs
            );
        }
    }

    if (debugCadenceEnabled) {
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
            const boundaryIndex = (() => {
                const direct = nextBoundaryIndex[firstHeavy.endIndex];
                return direct >= 0 ? direct : Math.max(0, renderChars.length - 1);
            })();
            const from = Math.max(0, firstHeavy.startIndex - 18);
            const to = Math.min(renderChars.length - 1, boundaryIndex + 18);
            const eventByCharIndex = new Map<number, TimelineEvent>();
            events.forEach((event) => {
                eventByCharIndex.set(event.charIndex, event);
            });
            const timingSample: Array<{
                charIndex: number;
                char: string;
                class: TimelineCharClass;
                deltaMs: number;
                charDelayMs: number;
                semanticPauseMs: number;
                pauseReason: PauseReason;
                semanticCategory: SemanticBoundaryCategory;
            }> = [];
            for (let idx = from; idx <= to; idx += 1) {
                const event = eventByCharIndex.get(idx);
                const className = classifyChar(renderChars[idx]);
                const semanticPauseMs = semanticPauseByIndex[idx] ?? 0;
                if ((className === 'letter' || className === 'digit') && semanticPauseMs > 0) {
                    console.log(
                        '[Welcome2Cadence][Violation] semantic pause on letter/digit charIndex=%d char=%s semanticPauseMs=%d',
                        idx,
                        JSON.stringify(renderChars[idx]),
                        semanticPauseMs
                    );
                }
                const charDelayMs = charDelayByIndex[idx] ?? 0;
                if ((className === 'letter' || className === 'digit') && charDelayMs !== expectedLetterDelay) {
                    console.log(
                        '[Welcome2Cadence] VIOLATION letter charDelayMs=%d expected=%d at index=%d char=%s',
                        charDelayMs,
                        expectedLetterDelay,
                        idx,
                        JSON.stringify(renderChars[idx])
                    );
                }
                timingSample.push({
                    charIndex: idx,
                    char: renderChars[idx],
                    class: className,
                    deltaMs: charDeltaByIndex[idx] ?? 0,
                    charDelayMs,
                    semanticPauseMs,
                    pauseReason: event?.pauseReason ?? 'base',
                    semanticCategory: semanticCategoryByIndex[idx] ?? 'none',
                });
            }
            console.log('[Welcome2Cadence] timing sample around first heavy word:', timingSample);
            console.log('[Welcome2Cadence] first heavy boundaryIndex=%d boundaryChar=%s', boundaryIndex, renderChars[boundaryIndex] ?? '');
        } else {
            console.log('[Welcome2Cadence] timing sample skipped no heavy words detected');
        }

        const firstSentencePunctuationIndex = renderChars.findIndex((char) => char === '.' || char === '?' || char === '!');
        if (firstSentencePunctuationIndex >= 0) {
            const from = Math.max(0, firstSentencePunctuationIndex - 18);
            const to = Math.min(renderChars.length - 1, firstSentencePunctuationIndex + 18);
            const eventByCharIndex = new Map<number, TimelineEvent>();
            events.forEach((event) => {
                eventByCharIndex.set(event.charIndex, event);
            });
            const punctuationSample: Array<{
                charIndex: number;
                char: string;
                class: TimelineCharClass;
                deltaMs: number;
                charDelayMs: number;
                semanticPauseMs: number;
                pauseReason: PauseReason;
                semanticCategory: SemanticBoundaryCategory;
            }> = [];
            for (let idx = from; idx <= to; idx += 1) {
                const event = eventByCharIndex.get(idx);
                const className = classifyChar(renderChars[idx]);
                const semanticPauseMs = semanticPauseByIndex[idx] ?? 0;
                if ((className === 'letter' || className === 'digit') && semanticPauseMs > 0) {
                    console.log(
                        '[Welcome2Cadence][Violation] semantic pause on letter/digit charIndex=%d char=%s semanticPauseMs=%d',
                        idx,
                        JSON.stringify(renderChars[idx]),
                        semanticPauseMs
                    );
                }
                const charDelayMs = charDelayByIndex[idx] ?? 0;
                if ((className === 'letter' || className === 'digit') && charDelayMs !== expectedLetterDelay) {
                    console.log(
                        '[Welcome2Cadence] VIOLATION letter charDelayMs=%d expected=%d at index=%d char=%s',
                        charDelayMs,
                        expectedLetterDelay,
                        idx,
                        JSON.stringify(renderChars[idx])
                    );
                }
                punctuationSample.push({
                    charIndex: idx,
                    char: renderChars[idx],
                    class: className,
                    deltaMs: charDeltaByIndex[idx] ?? 0,
                    charDelayMs,
                    semanticPauseMs,
                    pauseReason: event?.pauseReason ?? 'base',
                    semanticCategory: semanticCategoryByIndex[idx] ?? 'none',
                });
            }
            console.log('[Welcome2Cadence] timing sample around first sentence punctuation:', punctuationSample);
        } else {
            console.log('[Welcome2Cadence] punctuation sample skipped no sentence punctuation found');
        }

        const wordBoundarySemantic: number[] = [];
        const heavyWordBoundarySemantic: number[] = [];
        const landingBoundarySemantic: number[] = [];
        const punctuationTotalPauseNoMarker: number[] = [];
        const letterDigitCharDelays: number[] = [];
        const categoryToSemanticValues = new Map<SemanticBoundaryCategory, number[]>();
        const categories: SemanticBoundaryCategory[] = [
            'none',
            'word',
            'heavyWord',
            'landing',
            'marker',
            'newline',
            'paragraph',
        ];
        categories.forEach((category) => {
            categoryToSemanticValues.set(category, []);
        });

        events.forEach((event) => {
            const semanticMs = semanticPauseByIndex[event.charIndex] ?? 0;
            const semanticCategory = semanticCategoryByIndex[event.charIndex] ?? 'none';
            if (semanticCategory === 'word') wordBoundarySemantic.push(semanticMs);
            if (semanticCategory === 'heavyWord') heavyWordBoundarySemantic.push(semanticMs);
            if (semanticCategory === 'landing') landingBoundarySemantic.push(semanticMs);
            const list = categoryToSemanticValues.get(semanticCategory);
            if (list) {
                list.push(semanticMs);
            }
            if (event.class === 'letter' || event.class === 'digit') {
                letterDigitCharDelays.push(charDelayByIndex[event.charIndex] ?? 0);
            }
            if (
                event.class === 'punct' &&
                (event.char === '.' || event.char === '?' || event.char === '!') &&
                event.pauseReason !== 'marker'
            ) {
                punctuationTotalPauseNoMarker.push(event.pauseAfterMs);
            }
        });

        console.log('[Welcome2Cadence] boundary stats word=%o', summarizeMs(wordBoundarySemantic));
        console.log('[Welcome2Cadence] boundary stats heavyWord=%o', summarizeMs(heavyWordBoundarySemantic));
        console.log('[Welcome2Cadence] boundary stats landing=%o', summarizeMs(landingBoundarySemantic));
        console.log('[Welcome2Cadence] punctuation total pause (no marker)=%o', summarizeMs(punctuationTotalPauseNoMarker));
        console.log(
            '[Welcome2Cadence] letter/digit charDelay expected=%d stats=%o',
            expectedLetterDelay,
            summarizeMs(letterDigitCharDelays)
        );

        categories.forEach((category) => {
            const stats = summarizeMs(categoryToSemanticValues.get(category) ?? []);
            console.log('[Welcome2Cadence] semantic category stats category=%s stats=%o', category, stats);
        });

        const syntheticScenarios = [
            { label: 'heavyBeforePunct', text: 'this is very INTUITIVE.' },
            { label: 'heavyBeforePunctWithMarker', text: 'this is very INTUITIVE.{p=260}' },
            { label: 'landingOnly', text: 'this is simple.' },
            { label: 'backToBackHeavy', text: 'INTUITIVE KNOWLEDGE MEDIUM.' },
            { label: 'paragraphBreak', text: 'first line.\n\nsecond line.' },
        ];
        syntheticScenarios.forEach((scenario) => {
            const markerDefault = clampMs(tunedCadence.markerPauseDefaultMs);
            const built = buildRenderAndMarkerMap(scenario.text, markerDefault);
            const scenarioRenderText = built.renderChars.join('');
            const scenarioEmphasis = analyzeEmphasis(scenarioRenderText, tunedCadence.semantic);
            const scenarioNextBoundary = buildNextBoundaryIndex(built.renderChars);
            const scenarioAssembly = assembleSemanticBoundaryPauses(
                built.renderChars,
                built.markerPauseByCharIndex,
                scenarioNextBoundary,
                scenarioEmphasis,
                tunedCadence.semantic,
                true,
                scenario.label
            );

            const boundaryRows: Array<{
                index: number;
                char: string;
                class: TimelineCharClass;
                semanticPauseMs: number;
                semanticCategory: SemanticBoundaryCategory;
                sourceCount: number;
                flags: SemanticSourceFlags;
            }> = [];
            for (let idx = 0; idx < built.renderChars.length; idx += 1) {
                const charClass = classifyChar(built.renderChars[idx]);
                const semanticPauseMs = scenarioAssembly.semanticPauseByIndex[idx] ?? 0;
                const semanticCategory = scenarioAssembly.semanticCategoryByIndex[idx] ?? 'none';
                const flags = scenarioAssembly.semanticSourceFlagsByIndex[idx];
                const sourceCount = countSemanticSourceFlags(flags);
                if ((charClass === 'letter' || charClass === 'digit') && semanticPauseMs > 0) {
                    console.log(
                        '[Welcome2Cadence][Violation] scenario=%s semantic pause on letter/digit index=%d char=%s semanticPauseMs=%d',
                        scenario.label,
                        idx,
                        JSON.stringify(built.renderChars[idx]),
                        semanticPauseMs
                    );
                }
                if (isBoundaryChar(built.renderChars[idx]) || built.markerPauseByCharIndex[idx] !== undefined) {
                    boundaryRows.push({
                        index: idx,
                        char: built.renderChars[idx],
                        class: charClass,
                        semanticPauseMs,
                        semanticCategory,
                        sourceCount,
                        flags,
                    });
                }
            }

            console.log('[Welcome2Cadence] synthetic scenario=%s boundary rows=%o', scenario.label, boundaryRows);
        });
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
