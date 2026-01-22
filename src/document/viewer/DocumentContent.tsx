import React, { useMemo } from 'react';
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
    const blocks = useMemo(() => buildBlocks(text), [text]);
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
