export type Welcome2SentenceSpans = {
    partStartCharCountByIndex: number[];
    partEndCoreCharCountByIndex: number[];
    partEndSoftCharCountByIndex: number[];
};

type Welcome2PartSpan = {
    start: number;
    endCore: number;
    endSoft: number;
};

function isPartTerminator(ch: string): boolean {
    return ch === '.';
}

function isTrailingWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\n' || ch === '\t';
}

export function buildWelcome2SentenceSpans(renderText: string): Welcome2SentenceSpans {
    const rawParts: Welcome2PartSpan[] = [];
    const len = renderText.length;

    if (len === 0) {
        return {
            partStartCharCountByIndex: [0],
            partEndCoreCharCountByIndex: [0],
            partEndSoftCharCountByIndex: [0],
        };
    }

    let start = 0;
    let i = 0;
    while (i < len) {
        const ch = renderText[i];
        if (!isPartTerminator(ch)) {
            i += 1;
            continue;
        }

        const endCoreExclusive = i + 1;
        if (endCoreExclusive <= start) {
            start = endCoreExclusive;
            i = endCoreExclusive;
            continue;
        }

        let endSoftExclusive = endCoreExclusive;
        while (endSoftExclusive < len && isTrailingWhitespace(renderText[endSoftExclusive])) {
            endSoftExclusive += 1;
        }

        if (endSoftExclusive > start) {
            rawParts.push({
                start,
                endCore: endCoreExclusive,
                endSoft: endSoftExclusive,
            });
        }
        start = endSoftExclusive;
        i = endSoftExclusive;
    }

    if (start < len) {
        rawParts.push({
            start,
            endCore: len,
            endSoft: len,
        });
    }

    const parts: Welcome2PartSpan[] = [];
    for (const part of rawParts) {
        const isValidShape = part.start < part.endCore && part.start < part.endSoft && part.endCore <= part.endSoft;
        if (!isValidShape) {
            if (import.meta.env.DEV) {
                console.warn('[welcome2 parts] invalid span', part);
            }
            continue;
        }

        const prev = parts[parts.length - 1];
        const isValidChain =
            !prev ||
            (part.start === prev.endSoft && part.endSoft >= prev.endSoft);
        if (!isValidChain) {
            if (import.meta.env.DEV) {
                console.warn('[welcome2 parts] invalid span', part);
            }
            continue;
        }

        parts.push(part);
    }

    if (parts.length === 0 && len > 0) {
        parts.push({ start: 0, endCore: len, endSoft: len });
    }

    const starts = parts.map((part) => part.start);
    const coreEnds = parts.map((part) => part.endCore);
    const softEnds = parts.map((part) => part.endSoft);

    return {
        partStartCharCountByIndex: starts,
        partEndCoreCharCountByIndex: coreEnds,
        partEndSoftCharCountByIndex: softEnds,
    };
}

export function sentenceIndexForCharCount(
    charCount: number,
    sentenceEndCharCountByIndex: number[]
): number {
    if (sentenceEndCharCountByIndex.length === 0) return 0;
    const maxIndex = sentenceEndCharCountByIndex.length - 1;
    const safeCharCount = Math.max(0, charCount);

    let low = 0;
    let high = maxIndex;
    let answer = maxIndex;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (sentenceEndCharCountByIndex[mid] > safeCharCount) {
            answer = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    return answer;
}
