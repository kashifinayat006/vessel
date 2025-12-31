/**
 * Token estimation utilities
 *
 * Since we can't use the actual tokenizer for each model (they vary),
 * we use heuristic estimation that works reasonably well across models.
 *
 * Estimation strategies:
 * - Character-based: ~4 characters per token (English average)
 * - Word-based: ~1.3 tokens per word (accounts for subword tokenization)
 * - Hybrid: Combines both for better accuracy
 */

import type { TokenEstimate } from './types.js';

/** Tokens per image for vision models (conservative estimate) */
const TOKENS_PER_IMAGE = 765; // LLaVA typically uses ~765 tokens per image

/** Average characters per token (calibrated for LLaMA tokenizer) */
const CHARS_PER_TOKEN = 3.7;

/** Average tokens per word (accounts for subword tokenization) */
const TOKENS_PER_WORD = 1.3;

/**
 * Estimate token count for text using character-based heuristic
 */
export function estimateTokensFromChars(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate token count for text using word-based heuristic
 */
export function estimateTokensFromWords(text: string): number {
	if (!text) return 0;
	const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
	return Math.ceil(wordCount * TOKENS_PER_WORD);
}

/**
 * Hybrid token estimation (averages both methods)
 * This tends to be more accurate across different content types
 */
export function estimateTokens(text: string): number {
	if (!text) return 0;

	const charEstimate = estimateTokensFromChars(text);
	const wordEstimate = estimateTokensFromWords(text);

	// Use weighted average (char-based is usually more accurate for code)
	return Math.ceil((charEstimate * 0.6 + wordEstimate * 0.4));
}

/**
 * Estimate tokens for images
 * Vision models typically encode images as a fixed number of tokens
 */
export function estimateImageTokens(imageCount: number): number {
	return imageCount * TOKENS_PER_IMAGE;
}

/**
 * Get complete token estimate for a message
 */
export function estimateMessageTokens(
	content: string,
	images?: string[]
): TokenEstimate {
	const textTokens = estimateTokens(content);
	const imageTokens = estimateImageTokens(images?.length ?? 0);

	return {
		textTokens,
		imageTokens,
		totalTokens: textTokens + imageTokens
	};
}

/**
 * Estimate tokens for the message format overhead
 * (role markers, special tokens, etc.)
 */
export function estimateFormatOverhead(messageCount: number): number {
	// Each message has ~4 tokens of format overhead (role, special tokens)
	return messageCount * 4;
}

/**
 * Estimate total tokens for a conversation
 */
export function estimateConversationTokens(
	messages: Array<{ content: string; images?: string[] }>
): number {
	let total = 0;

	for (const msg of messages) {
		const estimate = estimateMessageTokens(msg.content, msg.images);
		total += estimate.totalTokens;
	}

	// Add format overhead
	total += estimateFormatOverhead(messages.length);

	return total;
}

/**
 * Format token count for display (e.g., "1.2K", "15K")
 */
export function formatTokenCount(tokens: number): string {
	if (tokens < 1000) {
		return tokens.toString();
	}
	if (tokens < 10000) {
		return (tokens / 1000).toFixed(1) + 'K';
	}
	return Math.round(tokens / 1000) + 'K';
}
