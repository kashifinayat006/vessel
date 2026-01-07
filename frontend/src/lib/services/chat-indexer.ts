/**
 * Chat Indexer Service
 * Indexes conversation messages for RAG search across project chats
 *
 * Note: Full embedding-based search requires an embedding model.
 * This is a placeholder that will be enhanced when embedding support is added.
 */

import { db } from '$lib/storage/db.js';
import type { StoredChatChunk } from '$lib/storage/db.js';
import type { Message } from '$lib/types/chat.js';
import { generateId } from '$lib/storage/db.js';

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
 * Note: Currently stores messages without embeddings.
 * Embeddings can be added later when an embedding model is available.
 */
export async function indexConversationMessages(
	conversationId: string,
	projectId: string,
	messages: Message[],
	options: IndexingOptions = {}
): Promise<number> {
	const {
		assistantOnly = true,
		minContentLength = 50
	} = options;

	// Filter messages to index
	const messagesToIndex = messages.filter((m) => {
		if (assistantOnly && m.role !== 'assistant') return false;
		if (m.content.length < minContentLength) return false;
		if (m.hidden) return false;
		return true;
	});

	if (messagesToIndex.length === 0) {
		return 0;
	}

	// Create chunks (without embeddings for now)
	const chunks: StoredChatChunk[] = messagesToIndex.map((m, index) => ({
		id: generateId(),
		conversationId,
		projectId,
		messageId: `${conversationId}-${index}`, // Placeholder message ID
		role: m.role as 'user' | 'assistant',
		content: m.content.slice(0, 2000), // Limit content length
		embedding: [], // Empty for now - will be populated when embedding support is added
		createdAt: Date.now()
	}));

	// Store chunks
	await db.chatChunks.bulkAdd(chunks);

	return chunks.length;
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
// Search Functions (Placeholder)
// ============================================================================

/**
 * Search indexed chat history within a project
 * Note: Currently returns empty results as embeddings are not yet implemented.
 * This will be enhanced when embedding support is added.
 */
export async function searchChatHistory(
	projectId: string,
	query: string,
	excludeConversationId?: string,
	topK: number = 5,
	threshold: number = 0.5
): Promise<ChatSearchResult[]> {
	// Get all chunks for this project
	const chunks = await db.chatChunks
		.where('projectId')
		.equals(projectId)
		.toArray();

	// Filter out excluded conversation
	const relevantChunks = excludeConversationId
		? chunks.filter((c) => c.conversationId !== excludeConversationId)
		: chunks;

	if (relevantChunks.length === 0) {
		return [];
	}

	// TODO: Implement embedding-based similarity search
	// For now, return empty results
	// When embeddings are available:
	// 1. Generate embedding for query
	// 2. Calculate cosine similarity with each chunk
	// 3. Return top K results above threshold

	return [];
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
