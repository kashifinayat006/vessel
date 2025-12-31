/**
 * Memory management types
 */

/** Token count estimate for a message */
export interface TokenEstimate {
	textTokens: number;
	imageTokens: number;
	totalTokens: number;
}

/** Context window usage information */
export interface ContextUsage {
	usedTokens: number;
	maxTokens: number;
	percentage: number;
	remainingTokens: number;
}

/** Model context window configuration */
export interface ModelContextConfig {
	/** Default context window size */
	defaultContextLength: number;
	/** Model-specific overrides (pattern -> context length) */
	modelPatterns: Map<string, number>;
}

/** Message with token estimate */
export interface MessageWithTokens {
	id: string;
	role: string;
	content: string;
	images?: string[];
	estimatedTokens: TokenEstimate;
}

/** Conversation summary */
export interface ConversationSummary {
	id: string;
	conversationId: string;
	summary: string;
	originalMessageCount: number;
	summarizedAt: Date;
	tokensSaved: number;
}

/** RAG document chunk */
export interface DocumentChunk {
	id: string;
	documentId: string;
	content: string;
	embedding?: number[];
	startIndex: number;
	endIndex: number;
	metadata?: Record<string, unknown>;
}

/** Knowledge base document */
export interface KnowledgeDocument {
	id: string;
	name: string;
	mimeType: string;
	content: string;
	chunks: DocumentChunk[];
	createdAt: Date;
	updatedAt: Date;
}
