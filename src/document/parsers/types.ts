/**
 * Document parser interface
 * All parsers must implement this interface for unified handling
 */

import type { ParsedDocument } from '../types';

export type ParserTimingStage = 'file_read_done' | 'text_extract_done';
export type ParserTimingCallback = (stage: ParserTimingStage) => void;

export interface DocumentParser {
    /**
     * Check if this parser can handle the given file
     */
    canHandle(file: File): boolean;

    /**
     * Parse the file and return a ParsedDocument
     */
    parse(file: File, onTiming?: ParserTimingCallback): Promise<ParsedDocument>;
}
