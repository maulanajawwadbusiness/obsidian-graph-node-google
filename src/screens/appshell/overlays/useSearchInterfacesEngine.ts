import React from 'react';
import { SavedInterfaceRecordV1 } from '../../../store/savedInterfacesStore';

const SEARCH_RECENT_LIMIT = 12;
const SEARCH_RESULT_LIMIT = 20;

export type SearchInterfaceResult = {
    id: string;
    sourceIndex: number;
    title: string;
    normalizedTitle: string;
    subtitle: string;
    updatedAt: number;
    nodeCount: number;
    linkCount: number;
    docId: string;
};

type UseSearchInterfacesEngineArgs = {
    savedInterfaces: SavedInterfaceRecordV1[];
    searchInterfacesQuery: string;
    searchHighlightedIndex: number;
    setSearchHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
};

type UseSearchInterfacesEngineResult = {
    filteredSearchResults: SearchInterfaceResult[];
};

function normalizeSearchText(raw: string): string {
    return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function useSearchInterfacesEngine(
    args: UseSearchInterfacesEngineArgs
): UseSearchInterfacesEngineResult {
    const {
        savedInterfaces,
        searchInterfacesQuery,
        searchHighlightedIndex,
        setSearchHighlightedIndex,
    } = args;

    const searchIndex = React.useMemo<SearchInterfaceResult[]>(
        () => savedInterfaces.map((record, sourceIndex) => ({
            id: record.id,
            sourceIndex,
            title: record.title,
            normalizedTitle: normalizeSearchText(record.title),
            subtitle: new Date(record.updatedAt).toLocaleString(),
            updatedAt: record.updatedAt,
            nodeCount: record.preview.nodeCount,
            linkCount: record.preview.linkCount,
            docId: record.docId,
        })),
        [savedInterfaces]
    );

    const filteredSearchResults = React.useMemo<SearchInterfaceResult[]>(() => {
        const normalizedQuery = normalizeSearchText(searchInterfacesQuery);
        if (normalizedQuery.length === 0) {
            return searchIndex.slice(0, SEARCH_RECENT_LIMIT);
        }
        const tokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
        if (tokens.length === 0) {
            return searchIndex.slice(0, SEARCH_RECENT_LIMIT);
        }
        const scored: Array<{ item: SearchInterfaceResult; score: number; bucket: number }> = [];
        for (const item of searchIndex) {
            let score = 0;
            let allMatched = true;
            let hasTokenPrefix = false;
            if (item.normalizedTitle.startsWith(normalizedQuery)) {
                score += 3000;
            }
            for (const token of tokens) {
                const idx = item.normalizedTitle.indexOf(token);
                if (idx < 0) {
                    allMatched = false;
                    break;
                }
                if (idx === 0) {
                    hasTokenPrefix = true;
                    score += 500;
                } else {
                    score += Math.max(1, 200 - idx);
                }
            }
            if (!allMatched) continue;
            const bucket = item.normalizedTitle.startsWith(normalizedQuery)
                ? 3
                : hasTokenPrefix
                    ? 2
                    : 1;
            score -= Math.abs(item.normalizedTitle.length - normalizedQuery.length);
            scored.push({ item, score, bucket });
        }
        scored.sort((a, b) => {
            if (a.bucket !== b.bucket) return b.bucket - a.bucket;
            if (a.score !== b.score) return b.score - a.score;
            if (a.item.updatedAt !== b.item.updatedAt) return b.item.updatedAt - a.item.updatedAt;
            return a.item.sourceIndex - b.item.sourceIndex;
        });
        return scored.slice(0, SEARCH_RESULT_LIMIT).map((entry) => entry.item);
    }, [searchIndex, searchInterfacesQuery]);

    React.useEffect(() => {
        if (filteredSearchResults.length === 0) {
            if (searchHighlightedIndex === -1) return;
            setSearchHighlightedIndex(-1);
            return;
        }
        const clamped = Math.min(
            Math.max(searchHighlightedIndex, 0),
            filteredSearchResults.length - 1
        );
        if (clamped === searchHighlightedIndex) return;
        setSearchHighlightedIndex(clamped);
    }, [filteredSearchResults.length, searchHighlightedIndex, setSearchHighlightedIndex]);

    React.useEffect(() => {
        if (searchHighlightedIndex !== -1) return;
        if (filteredSearchResults.length === 0) return;
        setSearchHighlightedIndex(0);
    }, [filteredSearchResults.length, searchHighlightedIndex, setSearchHighlightedIndex]);

    return {
        filteredSearchResults,
    };
}
