/**
 * Parser for Ollama Modelfile format
 * Extracts system prompts and other directives from modelfile strings
 *
 * Modelfile format reference: https://github.com/ollama/ollama/blob/main/docs/modelfile.md
 */

/**
 * Parse the SYSTEM directive from an Ollama modelfile string.
 *
 * Handles multiple formats:
 * - Multi-line with triple quotes: SYSTEM """...""" or SYSTEM '''...'''
 * - Single-line with quotes: SYSTEM "..." or SYSTEM '...'
 * - Unquoted single-line: SYSTEM Your prompt here
 *
 * @param modelfile - Raw modelfile string from Ollama /api/show
 * @returns Extracted system prompt or null if none found
 */
export function parseSystemPromptFromModelfile(modelfile: string): string | null {
	if (!modelfile) {
		return null;
	}

	// Pattern 1: Multi-line with triple double quotes
	// SYSTEM """
	// Your multi-line prompt
	// """
	const tripleDoubleQuoteMatch = modelfile.match(/SYSTEM\s+"""([\s\S]*?)"""/i);
	if (tripleDoubleQuoteMatch) {
		return tripleDoubleQuoteMatch[1].trim();
	}

	// Pattern 2: Multi-line with triple single quotes
	// SYSTEM '''
	// Your multi-line prompt
	// '''
	const tripleSingleQuoteMatch = modelfile.match(/SYSTEM\s+'''([\s\S]*?)'''/i);
	if (tripleSingleQuoteMatch) {
		return tripleSingleQuoteMatch[1].trim();
	}

	// Pattern 3: Single-line with double quotes
	// SYSTEM "Your prompt here"
	const doubleQuoteMatch = modelfile.match(/SYSTEM\s+"([^"]+)"/i);
	if (doubleQuoteMatch) {
		return doubleQuoteMatch[1].trim();
	}

	// Pattern 4: Single-line with single quotes
	// SYSTEM 'Your prompt here'
	const singleQuoteMatch = modelfile.match(/SYSTEM\s+'([^']+)'/i);
	if (singleQuoteMatch) {
		return singleQuoteMatch[1].trim();
	}

	// Pattern 5: Unquoted single-line (less common, stops at newline)
	// SYSTEM Your prompt here
	const unquotedMatch = modelfile.match(/^SYSTEM\s+([^\n"']+)$/im);
	if (unquotedMatch) {
		return unquotedMatch[1].trim();
	}

	return null;
}

/**
 * Parse the TEMPLATE directive from a modelfile.
 * Templates define how messages are formatted for the model.
 *
 * @param modelfile - Raw modelfile string
 * @returns Template string or null if none found
 */
export function parseTemplateFromModelfile(modelfile: string): string | null {
	if (!modelfile) {
		return null;
	}

	// Multi-line template with triple quotes
	const tripleQuoteMatch = modelfile.match(/TEMPLATE\s+"""([\s\S]*?)"""/i);
	if (tripleQuoteMatch) {
		return tripleQuoteMatch[1];
	}

	// Single-line template
	const singleLineMatch = modelfile.match(/TEMPLATE\s+"([^"]+)"/i);
	if (singleLineMatch) {
		return singleLineMatch[1];
	}

	return null;
}

/**
 * Parse PARAMETER directives from a modelfile.
 * Returns a map of parameter names to values.
 *
 * @param modelfile - Raw modelfile string
 * @returns Object with parameter name-value pairs
 */
export function parseParametersFromModelfile(modelfile: string): Record<string, string> {
	if (!modelfile) {
		return {};
	}

	const params: Record<string, string> = {};

	// Use matchAll to find all PARAMETER lines
	const matches = modelfile.matchAll(/^PARAMETER\s+(\w+)\s+(.+)$/gim);
	for (const match of matches) {
		params[match[1].toLowerCase()] = match[2].trim();
	}

	return params;
}

/**
 * Check if a modelfile has a SYSTEM directive defined.
 *
 * @param modelfile - Raw modelfile string
 * @returns true if SYSTEM directive exists
 */
export function hasSystemPrompt(modelfile: string): boolean {
	return parseSystemPromptFromModelfile(modelfile) !== null;
}
