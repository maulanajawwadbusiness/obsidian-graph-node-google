import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDocument } from '../../store/documentStore';
import { DocumentDockStrip } from './DocumentDockStrip';
import { DocumentContent } from './DocumentContent';
import { SearchBar } from './SearchBar';
import { getDocTheme, docThemeToCssVars } from './docTheme';
import { createSearchSession, navigateMatch, getActiveMatch, type SearchSession } from './searchSession';
import { findSpanContaining } from './selectionMapping';
import type { HighlightRange } from '../types';

/**
 * Document Viewer Panel - Main container
 * Has two states: peek (44px) and open (400px)
 * The panel glides smoothly between states (220ms/180ms)
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const DocumentViewerPanel: React.FC = () => {
    const { state, setDocTheme, setViewerMode, setHighlights, viewerApiRef } = useDocument();
    const [searchSession, setSearchSession] = useState<SearchSession | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const pendingScrollRef = useRef<number | null>(null);

    const isPeek = state.viewerMode === 'peek';

    // Get current theme
    const currentTheme = getDocTheme(state.docThemeMode);
    const themeVars = docThemeToCssVars(currentTheme);

    // Ctrl+F handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+F or Ctrl+B or Ctrl+\
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'b' || e.key === '\\')) {
                e.preventDefault();

                // Open viewer if peek
                if (isPeek) {
                    setViewerMode('open');
                }

                // Show search bar
                if (e.key === 'f') {
                    setShowSearch(true);
                }
            }

            // Esc key collapses to peek if search is not showing
            if (e.key === 'Escape' && !showSearch && !isPeek) {
                setViewerMode('peek');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPeek, showSearch, setViewerMode]);

    // Clear search state when document changes
    useEffect(() => {
        setShowSearch(false);
        setSearchSession(null);
        setHighlights([]);
    }, [state.activeDocument?.id, setHighlights]);

    // Handle search query change
    const handleSearch = useCallback((query: string) => {
        if (!state.activeDocument) return;

        const session = createSearchSession(state.activeDocument.text, query);
        setSearchSession(session);

        // Convert matches to highlight ranges
        const highlights: HighlightRange[] = session.matches.map((match, idx) => ({
            start: match.start,
            end: match.end,
            id: idx === session.activeIndex ? 'active' : `other-${idx}`,
        }));

        setHighlights(highlights);

        // Scroll to active match
        if (session.activeIndex !== -1) {
            scrollToOffset(session.matches[session.activeIndex].start);
        }
    }, [state.activeDocument, setHighlights]);

    // Navigate to next match
    const handleNext = useCallback(() => {
        if (!searchSession) return;

        const newSession = navigateMatch(searchSession, 1);
        setSearchSession(newSession);

        // Update highlights
        const highlights: HighlightRange[] = newSession.matches.map((match, idx) => ({
            start: match.start,
            end: match.end,
            id: idx === newSession.activeIndex ? 'active' : `other-${idx}`,
        }));
        setHighlights(highlights);

        // Scroll to active match
        const activeMatch = getActiveMatch(newSession);
        if (activeMatch) {
            scrollToOffset(activeMatch.start);
        }
    }, [searchSession, setHighlights]);

    // Navigate to previous match
    const handlePrev = useCallback(() => {
        if (!searchSession) return;

        const newSession = navigateMatch(searchSession, -1);
        setSearchSession(newSession);

        // Update highlights
        const highlights: HighlightRange[] = newSession.matches.map((match, idx) => ({
            start: match.start,
            end: match.end,
            id: idx === newSession.activeIndex ? 'active' : `other-${idx}`,
        }));
        setHighlights(highlights);

        // Scroll to active match
        const activeMatch = getActiveMatch(newSession);
        if (activeMatch) {
            scrollToOffset(activeMatch.start);
        }
    }, [searchSession, setHighlights]);

    // Close search
    const handleCloseSearch = useCallback(() => {
        setShowSearch(false);
        setSearchSession(null);
        setHighlights([]);
    }, [setHighlights]);

    // Scroll to character offset
    const scrollToOffset = useCallback((offset: number) => {
        if (!contentRef.current) {
            pendingScrollRef.current = offset;
            return;
        }

        // Find the element containing this offset
        const span = findSpanContaining(contentRef.current, offset);
        if (span) {
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, []);

    useEffect(() => {
        viewerApiRef.current = { scrollToOffset };
        return () => {
            viewerApiRef.current = null;
        };
    }, [scrollToOffset, viewerApiRef]);

    useEffect(() => {
        if (isPeek) return;
        if (pendingScrollRef.current === null) return;
        const pendingOffset = pendingScrollRef.current;
        pendingScrollRef.current = null;
        scrollToOffset(pendingOffset);
    }, [isPeek, scrollToOffset]);

    const panelStyle: React.CSSProperties = {
        position: 'relative',
        flexShrink: 0,
        width: isPeek ? '44px' : '400px',
        height: '100%',
        backgroundColor: 'rgba(var(--panel-bg-rgb), var(--panel-bg-opacity))',
        backdropFilter: 'blur(12px)',
        transition: isPeek
            ? 'width 180ms cubic-bezier(0.22, 1, 0.36, 1)'  // Peek (collapse)
            : 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)', // Open (expand)
        overflow: 'hidden',
        zIndex: 100,
        ...themeVars,
    };

    const sliverStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: '12px',  // After dock strip
        bottom: 0,
        right: 0,
        backgroundColor: currentTheme.sheetBg,
        pointerEvents: isPeek ? 'none' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        opacity: isPeek ? 0.3 : 1,
        transition: 'opacity 180ms ease-out',
    };

    const headerStyle: React.CSSProperties = {
        padding: '16px 20px',
        borderBottom: `1px solid rgba(99, 171, 255, 0.15)`,
        flexShrink: 0,
        display: isPeek ? 'none' : 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: currentTheme.text,
        fontSize: '13px',
        fontFamily: currentTheme.fontFamily,
    };

    const themeToggleStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: currentTheme.mutedText,
        cursor: 'pointer',
        fontSize: '16px',
        padding: '4px 8px',
        transition: 'filter 120ms ease-out',
        filter: 'brightness(1)',
    };

    const contentStyle: React.CSSProperties = {
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: isPeek ? 'none' : 'block',
    };

    return (
        <div
            className="doc-viewer-root"
            style={panelStyle}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
        >
            <DocumentDockStrip />

            <div style={sliverStyle}>
                {!isPeek && (
                    <>
                        <div style={headerStyle}>
                            <div>
                                {state.activeDocument
                                    ? `📄 ${state.activeDocument.fileName}`
                                    : '📄 No Document'}
                            </div>
                            <button
                                type="button"
                                style={themeToggleStyle}
                                onClick={() => setDocTheme(state.docThemeMode === 'dark' ? 'light' : 'dark')}
                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.4)'}
                                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                                aria-label="Toggle theme"
                                title={`Switch to ${state.docThemeMode === 'dark' ? 'light' : 'dark'} mode`}
                            >
                                {state.docThemeMode === 'dark' ? '☀' : '🌙'}
                            </button>
                        </div>

                        {showSearch && (
                            <SearchBar
                                onSearch={handleSearch}
                                onNext={handleNext}
                                onPrev={handlePrev}
                                onClose={handleCloseSearch}
                                matchCount={searchSession?.matches.length ?? 0}
                                activeIndex={searchSession?.activeIndex ?? -1}
                            />
                        )}

                        <div className="arnvoid-scroll" style={contentStyle} ref={contentRef}>
                            {state.activeDocument ? (
                                <DocumentContent
                                    text={state.activeDocument.text}
                                    highlights={state.highlightRanges}
                                    containerRef={contentRef}
                                />
                            ) : (
                                <div style={{ color: currentTheme.mutedText, fontStyle: 'italic' }}>
                                    Drop a document onto the canvas to view it here
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
