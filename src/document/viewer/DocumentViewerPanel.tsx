import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDocument } from '../../store/documentStore';
import { DocumentContent } from './DocumentContent';
import { SearchBar } from './SearchBar';
import { getDocTheme, docThemeToCssVars } from './docTheme';
import { createSearchSession, navigateMatch, getActiveMatch, type SearchSession } from './searchSession';
import { findSpanContaining } from './selectionMapping';
import type { HighlightRange } from '../types';
import './viewerTokens.css';
import documentModeIcon from '../../assets/document_mode_icon.png';

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
    const hasDocument = !!state.activeDocument;

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
        width: isPeek ? '0px' : 'var(--panel-width)',
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
        left: 0,
        bottom: 0,
        right: 0,
        backgroundColor: isPeek && hasDocument
            ? 'rgba(var(--panel-bg-rgb), 0.25)'  // Faint sheet edge when peeking with doc
            : currentTheme.sheetBg,
        pointerEvents: isPeek ? 'none' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        opacity: isPeek ? 0.3 : 1,
        transition: 'opacity 180ms ease-out, background-color 180ms ease-out',
        // Subtle texture/depth for sheet edge
        boxShadow: isPeek && hasDocument
            ? 'inset 1px 0 2px rgba(0, 0, 0, 0.15), inset 0 0 8px rgba(var(--panel-bg-rgb), 0.3)'
            : 'none',
    };

    const contentStyle: React.CSSProperties = {
        flex: 1,
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
            <div style={sliverStyle}>
                {!isPeek && (
                    <>
                        <header className="dv-header">
                            <span className="dv-header-title">DOCUMENT VIEWER</span>
                            <div className="dv-header-actions">
                                <button
                                    type="button"
                                    className="dv-persona-toggle"
                                    data-mode={state.docThemeMode}
                                    onClick={() => setDocTheme(state.docThemeMode === 'dark' ? 'light' : 'dark')}
                                    aria-label="Switch document mode"
                                    title="Switch document mode"
                                >
                                    <img className="dv-persona-icon" src={documentModeIcon} alt="" />
                                    <span className="dv-persona-label">Mode</span>
                                </button>
                            </div>
                        </header>

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

                        <div className="arnvoid-scroll dv-content" style={contentStyle} ref={contentRef}>
                            <div className="dv-document">
                                <div className="dv-document-title">
                                    {state.activeDocument ? state.activeDocument.fileName : 'No Document'}
                                </div>
                                <div className="dv-document-body">
                                    {state.activeDocument ? (
                                        <DocumentContent
                                            text={state.activeDocument.text}
                                            highlights={state.highlightRanges}
                                            containerRef={contentRef}
                                        />
                                    ) : (
                                        <div className="dv-empty-state">
                                            <p className="dv-empty-instruction">
                                                Drop a document onto the canvas to view it here
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
