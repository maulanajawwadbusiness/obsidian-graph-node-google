import React, { useMemo, useRef, useEffect } from 'react';
import { buildBlocks } from './documentModel';
import { DocumentBlock } from './DocumentBlock';
import type { HighlightRange } from '../types';
import { useVirtualBlocks } from './useVirtualBlocks';

/**
 * DocumentContent - Renders the document text as blocks
 * (Non-virtualized for v1 - virtualization added in Run 7)
 */

export interface DocumentContentProps {
    text: string;
    highlights?: HighlightRange[];
    containerRef: React.RefObject<HTMLElement>;
}

export const DocumentContent: React.FC<DocumentContentProps> = ({ text, highlights, containerRef }) => {
    const perfEnabled = typeof window !== 'undefined' && Boolean((window as typeof window & { __DOC_VIEWER_PROFILE__?: boolean }).__DOC_VIEWER_PROFILE__);
    const renderCountRef = useRef(0);
    const buildCountRef = useRef(0);
    renderCountRef.current += 1;

    const blocks = useMemo(() => {
        const start = performance.now();
        const nextBlocks = buildBlocks(text);
        const duration = performance.now() - start;
        buildCountRef.current += 1;
        if (perfEnabled) {
            console.debug('[DocViewer] buildBlocks', {
                count: buildCountRef.current,
                blocks: nextBlocks.length,
                durationMs: Number(duration.toFixed(2)),
            });
        }
        return nextBlocks;
    }, [perfEnabled, text]);
    const { blocks: visibleBlocks, topSpacerHeight, bottomSpacerHeight } = useVirtualBlocks(blocks, containerRef);

    const contentWrapperStyle: React.CSSProperties = {
        fontFamily: 'var(--doc-font-family)',
        fontSize: 'var(--doc-font-size, 13px)',
        lineHeight: 'var(--doc-line-height, 1.65)',
        fontWeight: 'var(--doc-font-weight)',
        color: 'var(--doc-text)',
        maxWidth: 'var(--doc-max-line-width, 68ch)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
    };

    useEffect(() => {
        if (!perfEnabled) return;
        console.debug('[DocViewer] DocumentContent render', {
            count: renderCountRef.current,
            visibleBlocks: visibleBlocks.length,
        });
    }, [perfEnabled, visibleBlocks.length]);

    return (
        <div style={contentWrapperStyle}>
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
            {visibleBlocks.map(block => (
                <DocumentBlock
                    key={block.blockId}
                    blockId={block.blockId}
                    start={block.start}
                    end={block.end}
                    text={block.text}
                    highlights={highlights}
                />
            ))}
            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
        </div>
    );
};
