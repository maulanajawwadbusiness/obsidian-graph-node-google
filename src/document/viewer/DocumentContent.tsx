import React, { useMemo } from 'react';
import { buildBlocks } from './documentModel';
import { DocumentBlock } from './DocumentBlock';
import type { HighlightRange } from '../types';

/**
 * DocumentContent - Renders the document text as blocks
 * (Non-virtualized for v1 - virtualization added in Run 7)
 */

export interface DocumentContentProps {
    text: string;
    highlights?: HighlightRange[];
}

export const DocumentContent: React.FC<DocumentContentProps> = ({ text, highlights }) => {
    const blocks = useMemo(() => buildBlocks(text), [text]);

    const contentWrapperStyle: React.CSSProperties = {
        fontFamily: 'var(--doc-font-family)',
        fontSize: 'var(--doc-font-size, 15px)',
        lineHeight: 'var(--doc-line-height, 1.6)',
        fontWeight: 'var(--doc-font-weight)',
        color: 'var(--doc-text)',
        maxWidth: 'var(--doc-max-line-width, 68ch)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
    };

    return (
        <div style={contentWrapperStyle}>
            {blocks.map(block => (
                <DocumentBlock
                    key={block.blockId}
                    blockId={block.blockId}
                    start={block.start}
                    end={block.end}
                    text={block.text}
                    highlights={highlights}
                />
            ))}
        </div>
    );
};
