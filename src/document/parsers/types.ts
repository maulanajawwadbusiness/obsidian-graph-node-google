/**
 * Document parser interface
 * All parsers must implement this interface for unified handling
 */

import type { ParsedDocument } from '../types';

export interface DocumentParser {
    /**
     * Check if this parser can handle the given file
     */
    canHandle(file: File): boolean;

    /**
     * Parse the file and return a ParsedDocument
     */
    parse(file: File): Promise<ParsedDocument>;
}
