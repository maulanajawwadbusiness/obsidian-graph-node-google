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

    const containerStyle: React.CSSProperties = {
        padding: '12px 20px',
        borderBottom: '1px solid rgba(99, 171, 255, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(var(--panel-bg-rgb), 0.5)',
    };

    const inputStyle: React.CSSProperties = {
        flex: 1,
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(99, 171, 255, 0.2)',
        borderRadius: '4px',
        padding: '6px 10px',
        color: 'var(--doc-text)',
        fontSize: '13px',
        fontFamily: 'var(--doc-font-family)',
    };

    const buttonStyle: React.CSSProperties = {
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(99, 171, 255, 0.2)',
        borderRadius: '4px',
        padding: '6px 10px',
        color: 'var(--doc-text)',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: 'var(--doc-font-family)',
    };

    const counterStyle: React.CSSProperties = {
        fontSize: '11px',
        color: 'var(--doc-muted-text)',
        fontFamily: 'var(--doc-font-family)',
        minWidth: '60px',
        textAlign: 'center',
    };

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
        <div style={containerStyle}>
            <input
                ref={inputRef}
                type="text"
                style={inputStyle}
                placeholder="Search in document..."
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
            <div style={counterStyle}>
                {matchCount > 0
                    ? `${activeIndex + 1}/${matchCount}`
                    : query ? '0/0' : ''
                }
            </div>
            <button
                type="button"
                style={buttonStyle}
                onClick={onPrev}
                disabled={matchCount === 0}
                title="Previous match (Shift+Enter)"
            >
                ↑
            </button>
            <button
                type="button"
                style={buttonStyle}
                onClick={onNext}
                disabled={matchCount === 0}
                title="Next match (Enter)"
            >
                ↓
            </button>
            <button
                type="button"
                style={buttonStyle}
                onClick={onClose}
                title="Close search (Esc)"
            >
                ✕
            </button>
        </div>
    );
};
