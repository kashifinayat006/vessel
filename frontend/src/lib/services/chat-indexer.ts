/**
 * Chat Indexer Service
 * Indexes conversation messages for RAG search across project chats
 */

import { db } from '$lib/storage/db.js';
import type { StoredChatChunk } from '$lib/storage/db.js';
import type { Message } from '$lib/types/chat.js';
import { generateId } from '$lib/storage/db.js';
import {
	generateEmbedding,
	findSimilar,
	DEFAULT_EMBEDDING_MODEL
} from '$lib/memory/embeddings.js';

// ============================================================================
// Types
// ============================================================================

export interface IndexingOptions {
	/** Embedding model to use (e.g., 'nomic-embed-text') */
	embeddingModel?: string;
	/** Base URL for Ollama API */
	baseUrl?: string;
	/** Only index assistant messages (recommended) */
	assistantOnly?: boolean;
	/** Minimum content length to index */
	minContentLength?: number;
}

export interface ChatSearchResult {
	conversationId: string;
	conversationTitle: string;
	messageId: string;
	content: string;
	similarity: number;
}

// ============================================================================
// Indexing Functions
// ============================================================================

/**
 * Index messages from a conversation for RAG search
 * Generates embeddings for each message and stores them for similarity search
 * @param projectId - Project ID or null for global conversations
 */
export async function indexConversationMessages(
	conversationId: string,
	projectId: string | null,
	messages: Message[],
	options: IndexingOptions = {}
): Promise<number> {
	const {
		embeddingModel = DEFAULT_EMBEDDING_MODEL,
		assistantOnly = false, // Index both user and assistant for better context
		minContentLength = 20
	} = options;

	// Filter messages to index
	const messagesToIndex = messages.filter((m) => {
		if (assistantOnly && m.role !== 'assistant') return false;
		if (m.role !== 'user' && m.role !== 'assistant') return false;
		if (!m.content || m.content.length < minContentLength) return false;
		if (m.hidden) return false;
		return true;
	});

	if (messagesToIndex.length === 0) {
		return 0;
	}

	// Check which messages are already indexed by checking if first 500 chars exist
	const existingChunks = await db.chatChunks
		.where('conversationId')
		.equals(conversationId)
		.toArray();
	// Use first 500 chars as signature to detect already-indexed messages
	const existingSignatures = new Set(existingChunks.map((c) => c.content.slice(0, 500)));

	// Filter out already indexed messages
	const newMessages = messagesToIndex.filter(
		(m) => !existingSignatures.has(m.content.slice(0, 500))
	);

	if (newMessages.length === 0) {
		return 0;
	}

	console.log(`[ChatIndexer] Indexing ${newMessages.length} new messages for conversation ${conversationId}`);

	// Generate embeddings and create chunks
	// For long messages, split into multiple chunks
	const CHUNK_SIZE = 1500;
	const CHUNK_OVERLAP = 200;

	const chunks: StoredChatChunk[] = [];
	for (let i = 0; i < newMessages.length; i++) {
		const m = newMessages[i];
		const content = m.content;

		// Split long messages into chunks
		const messageChunks: string[] = [];
		if (content.length <= CHUNK_SIZE) {
			messageChunks.push(content);
		} else {
			// Chunk with overlap for better context
			let start = 0;
			while (start < content.length) {
				const end = Math.min(start + CHUNK_SIZE, content.length);
				messageChunks.push(content.slice(start, end));
				start = end - CHUNK_OVERLAP;
				if (start >= content.length - CHUNK_OVERLAP) break;
			}
		}

		// Create chunk for each piece
		for (let j = 0; j < messageChunks.length; j++) {
			const chunkContent = messageChunks[j];
			try {
				const embedding = await generateEmbedding(chunkContent, embeddingModel);

				chunks.push({
					id: generateId(),
					conversationId,
					projectId,
					messageId: `${conversationId}-${Date.now()}-${i}-${j}`,
					role: m.role as 'user' | 'assistant',
					content: chunkContent,
					embedding,
					createdAt: Date.now()
				});
			} catch (error) {
				console.error(`[ChatIndexer] Failed to generate embedding for chunk:`, error);
				// Continue with other chunks
			}
		}
	}

	if (chunks.length > 0) {
		await db.chatChunks.bulkAdd(chunks);
		console.log(`[ChatIndexer] Successfully indexed ${chunks.length} messages`);
	}

	return chunks.length;
}

/**
 * Force re-index a conversation (clears existing and re-indexes)
 */
export async function forceReindexConversation(
	conversationId: string,
	projectId: string,
	messages: Message[],
	options: IndexingOptions = {}
): Promise<number> {
	console.log(`[ChatIndexer] Force re-indexing conversation: ${conversationId}`);

	// Clear existing chunks
	const deleted = await db.chatChunks.where('conversationId').equals(conversationId).delete();
	console.log(`[ChatIndexer] Cleared ${deleted} existing chunks`);

	// Re-index (this will now create chunked messages)
	return indexConversationMessages(conversationId, projectId, messages, options);
}

/**
 * Re-index a conversation when it moves to/from a project
 */
export async function reindexConversationForProject(
	conversationId: string,
	newProjectId: string | null
): Promise<void> {
	// Remove existing chunks for this conversation
	await db.chatChunks.where('conversationId').equals(conversationId).delete();

	// If moving to a project, chunks will be re-created when needed
	// For now, this is a placeholder - actual re-indexing would happen
	// when the conversation is opened or when summaries are generated
}

/**
 * Remove all indexed chunks for a conversation
 */
export async function removeConversationFromIndex(conversationId: string): Promise<void> {
	await db.chatChunks.where('conversationId').equals(conversationId).delete();
}

/**
 * Remove all indexed chunks for a project
 */
export async function removeProjectFromIndex(projectId: string): Promise<void> {
	await db.chatChunks.where('projectId').equals(projectId).delete();
}

// ============================================================================
// Search Functions
// ============================================================================

export interface SearchChatOptions {
	/** Project ID to search within, null for global search */
	projectId?: string | null;
	/** Conversation ID to exclude from results */
	excludeConversationId?: string;
	/** Maximum number of results */
	topK?: number;
	/** Minimum similarity threshold */
	threshold?: number;
	/** Embedding model to use */
	embeddingModel?: string;
}

/**
 * Search indexed chat history using embedding similarity
 * Can search within a project, globally, or both
 */
export async function searchChatHistory(
	query: string,
	options: SearchChatOptions = {}
): Promise<ChatSearchResult[]> {
	const {
		projectId,
		excludeConversationId,
		topK = 10,
		threshold = 0.2,
		embeddingModel = DEFAULT_EMBEDDING_MODEL
	} = options;

	// Get chunks based on scope
	let chunks: StoredChatChunk[];
	if (projectId !== undefined) {
		// Project-scoped search (projectId can be string or null)
		if (projectId === null) {
			// Search only global (non-project) conversations
			chunks = await db.chatChunks.filter((c) => c.projectId === null).toArray();
		} else {
			// Search within specific project
			chunks = await db.chatChunks.where('projectId').equals(projectId).toArray();
		}
	} else {
		// Global search - all chunks
		chunks = await db.chatChunks.toArray();
	}

	// Filter out excluded conversation and chunks without embeddings
	const relevantChunks = chunks.filter((c) => {
		if (excludeConversationId && c.conversationId === excludeConversationId) return false;
		if (!c.embedding || c.embedding.length === 0) return false;
		return true;
	});

	if (relevantChunks.length === 0) {
		return [];
	}

	try {
		// Generate embedding for query
		const queryEmbedding = await generateEmbedding(query, embeddingModel);

		// Validate embedding was generated successfully
		if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
			console.warn('[ChatIndexer] Failed to generate query embedding - is the embedding model available?');
			return [];
		}

		// Find similar chunks
		const similar = findSimilar(queryEmbedding, relevantChunks, topK, threshold);

		if (similar.length === 0) {
			return [];
		}

		// Get conversation titles for results
		const conversationIds = [...new Set(similar.map((s) => s.conversationId))];
		const conversations = await db.conversations.bulkGet(conversationIds);
		const titleMap = new Map(
			conversations.filter(Boolean).map((c) => [c!.id, c!.title])
		);

		// Format results
		return similar.map((chunk) => ({
			conversationId: chunk.conversationId,
			conversationTitle: titleMap.get(chunk.conversationId) || 'Unknown',
			messageId: chunk.messageId,
			content: chunk.content,
			similarity: chunk.similarity
		}));
	} catch (error) {
		console.error('[ChatIndexer] Search failed:', error);
		return [];
	}
}

/**
 * Search chat history within a specific project (legacy API)
 */
export async function searchProjectChatHistory(
	projectId: string,
	query: string,
	excludeConversationId?: string,
	topK: number = 10,
	threshold: number = 0.2
): Promise<ChatSearchResult[]> {
	return searchChatHistory(query, {
		projectId,
		excludeConversationId,
		topK,
		threshold
	});
}

/**
 * Search all indexed chat history globally
 */
export async function searchAllChatHistory(
	query: string,
	excludeConversationId?: string,
	topK: number = 20,
	threshold: number = 0.2
): Promise<ChatSearchResult[]> {
	return searchChatHistory(query, {
		excludeConversationId,
		topK,
		threshold
	});
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get indexing statistics for a project
 */
export async function getProjectIndexStats(projectId: string): Promise<{
	totalChunks: number;
	conversationCount: number;
}> {
	const chunks = await db.chatChunks
		.where('projectId')
		.equals(projectId)
		.toArray();

	const conversationIds = new Set(chunks.map((c) => c.conversationId));

	return {
		totalChunks: chunks.length,
		conversationCount: conversationIds.size
	};
}

/**
 * Check if a conversation is indexed
 */
export async function isConversationIndexed(conversationId: string): Promise<boolean> {
	const count = await db.chatChunks
		.where('conversationId')
		.equals(conversationId)
		.count();

	return count > 0;
}
