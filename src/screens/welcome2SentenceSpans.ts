export type Welcome2SentenceSpans = {
    sentenceStartCharCountByIndex: number[];
    sentenceEndCoreCharCountByIndex: number[];
    sentenceEndSoftCharCountByIndex: number[];
};

function isSentenceTerminator(ch: string): boolean {
    return ch === '.' || ch === '?' || ch === '!';
}

function isTrailingWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\n' || ch === '\t';
}

function isSentenceCloser(ch: string): boolean {
    return ch === '"' || ch === '\'' || ch === ')' || ch === ']' || ch === '}';
}

export function buildWelcome2SentenceSpans(renderText: string): Welcome2SentenceSpans {
    const starts: number[] = [];
    const coreEnds: number[] = [];
    const softEnds: number[] = [];
    const len = renderText.length;

    if (len === 0) {
        return {
            sentenceStartCharCountByIndex: [0],
            sentenceEndCoreCharCountByIndex: [0],
            sentenceEndSoftCharCountByIndex: [0],
        };
    }

    let start = 0;
    let i = 0;
    while (i < len) {
        const ch = renderText[i];
        if (!isSentenceTerminator(ch)) {
            i += 1;
            continue;
        }

        let endCoreExclusive = i + 1;
        while (endCoreExclusive < len && isSentenceCloser(renderText[endCoreExclusive])) {
            endCoreExclusive += 1;
        }

        let endSoftExclusive = endCoreExclusive;
        while (endSoftExclusive < len && isTrailingWhitespace(renderText[endSoftExclusive])) {
            endSoftExclusive += 1;
        }

        starts.push(start);
        coreEnds.push(endCoreExclusive);
        softEnds.push(endSoftExclusive);
        start = endSoftExclusive;
        i = endSoftExclusive;
    }

    if (starts.length === 0 || start < len) {
        starts.push(start);
        coreEnds.push(len);
        softEnds.push(len);
    }

    return {
        sentenceStartCharCountByIndex: starts,
        sentenceEndCoreCharCountByIndex: coreEnds,
        sentenceEndSoftCharCountByIndex: softEnds,
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
