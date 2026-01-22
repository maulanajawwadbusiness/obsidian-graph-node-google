import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchBar - Document search input with match counter
 * Ctrl+F focuses this input and opens viewer if in peek mode
 */

export interface SearchBarProps {
    onSearch: (query: string) => void;
    onNext: () => void;
    onPrev: () => void;
    onClose: () => void;
    matchCount: number;
    activeIndex: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    onNext,
    onPrev,
    onClose,
    matchCount,
    activeIndex,
}) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<number | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
            onSearch(newQuery);
        }, 300);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                onPrev();
            } else {
                onNext();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    // Focus input when component mounts
    useEffect(() => {
        inputRef.current?.focus();
        return () => {
            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return (
        <div className="dv-search-bar">
            <input
                ref={inputRef}
                type="text"
                className="dv-search-input"
                placeholder="Search in document..."
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
            <div className="dv-search-counter">
                {matchCount > 0
                    ? `${activeIndex + 1}/${matchCount}`
                    : query ? '0/0' : ''
                }
            </div>
            <button
                type="button"
                className="dv-search-button"
                onClick={onPrev}
                disabled={matchCount === 0}
                title="Previous match (Shift+Enter)"
            >
                ↑
            </button>
            <button
                type="button"
                className="dv-search-button"
                onClick={onNext}
                disabled={matchCount === 0}
                title="Next match (Enter)"
            >
                ↓
            </button>
            <button
                type="button"
                className="dv-search-button"
                onClick={onClose}
                title="Close search (Esc)"
            >
                ✕
            </button>
        </div>
    );
};
