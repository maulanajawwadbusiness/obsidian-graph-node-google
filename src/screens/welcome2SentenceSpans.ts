export type Welcome2SentenceSpans = {
    sentenceStartCharCountByIndex: number[];
    sentenceEndCharCountByIndex: number[];
};

function isSentenceTerminator(ch: string): boolean {
    return ch === '.' || ch === '?' || ch === '!';
}

function isTrailingWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\n' || ch === '\t';
}

export function buildWelcome2SentenceSpans(renderText: string): Welcome2SentenceSpans {
    const starts: number[] = [];
    const ends: number[] = [];
    const len = renderText.length;

    if (len === 0) {
        return {
            sentenceStartCharCountByIndex: [0],
            sentenceEndCharCountByIndex: [0],
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

        let endExclusive = i + 1;
        while (endExclusive < len && isTrailingWhitespace(renderText[endExclusive])) {
            endExclusive += 1;
        }

        starts.push(start);
        ends.push(endExclusive);
        start = endExclusive;
        i = endExclusive;
    }

    if (starts.length === 0 || start < len) {
        starts.push(start);
        ends.push(len);
    }

    return {
        sentenceStartCharCountByIndex: starts,
        sentenceEndCharCountByIndex: ends,
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
