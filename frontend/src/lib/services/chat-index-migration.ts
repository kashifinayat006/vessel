/**
 * Chat Index Migration Service
 * Background service that indexes existing conversations for semantic search
 * Processes in small batches to avoid blocking the UI
 */

import { db } from '$lib/storage/db.js';
import { indexConversationMessages, isConversationIndexed } from './chat-indexer.js';
import type { Message } from '$lib/types/chat.js';
import { settingsState } from '$lib/stores';

// ============================================================================
// Types
// ============================================================================

export interface MigrationProgress {
	total: number;
	indexed: number;
	skipped: number;
	failed: number;
	isRunning: boolean;
	currentConversation: string | null;
}

export interface MigrationOptions {
	/** Number of conversations to process per batch */
	batchSize?: number;
	/** Delay between batches in ms */
	batchDelay?: number;
	/** Minimum messages required to index a conversation */
	minMessages?: number;
	/** Embedding model to use */
	embeddingModel?: string;
	/** Callback for progress updates */
	onProgress?: (progress: MigrationProgress) => void;
}

// ============================================================================
// State
// ============================================================================

let migrationInProgress = false;
let migrationAborted = false;

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Run the chat index migration in the background
 * Indexes all conversations that don't have chat chunks yet
 */
export async function runChatIndexMigration(options: MigrationOptions = {}): Promise<MigrationProgress> {
	const {
		batchSize = 2,
		batchDelay = 500,
		minMessages = 2,
		embeddingModel,
		onProgress
	} = options;

	// Prevent multiple migrations running at once
	if (migrationInProgress) {
		console.log('[ChatIndexMigration] Migration already in progress, skipping');
		return {
			total: 0,
			indexed: 0,
			skipped: 0,
			failed: 0,
			isRunning: true,
			currentConversation: null
		};
	}

	migrationInProgress = true;
	migrationAborted = false;

	const progress: MigrationProgress = {
		total: 0,
		indexed: 0,
		skipped: 0,
		failed: 0,
		isRunning: true,
		currentConversation: null
	};

	try {
		// Get all conversations
		const allConversations = await db.conversations.toArray();
		progress.total = allConversations.length;

		console.log(`[ChatIndexMigration] Starting migration for ${progress.total} conversations`);
		onProgress?.(progress);

		// Process in batches
		for (let i = 0; i < allConversations.length; i += batchSize) {
			if (migrationAborted) {
				console.log('[ChatIndexMigration] Migration aborted');
				break;
			}

			const batch = allConversations.slice(i, i + batchSize);

			// Process batch in parallel
			await Promise.all(batch.map(async (conversation) => {
				if (migrationAborted) return;

				progress.currentConversation = conversation.title;
				onProgress?.(progress);

				try {
					// Check if already indexed
					const isIndexed = await isConversationIndexed(conversation.id);
					if (isIndexed) {
						progress.skipped++;
						return;
					}

					// Skip conversations with too few messages
					if (conversation.messageCount < minMessages) {
						progress.skipped++;
						return;
					}

					// Get messages for this conversation
					const messages = await getMessagesForIndexing(conversation.id);
					if (messages.length < minMessages) {
						progress.skipped++;
						return;
					}

					// Index the conversation
					const projectId = conversation.projectId || null;
					const chunksIndexed = await indexConversationMessages(
						conversation.id,
						projectId,
						messages,
						{ embeddingModel }
					);

					if (chunksIndexed > 0) {
						progress.indexed++;
						console.log(`[ChatIndexMigration] Indexed "${conversation.title}" (${chunksIndexed} chunks)`);
					} else {
						progress.skipped++;
					}
				} catch (error) {
					console.error(`[ChatIndexMigration] Failed to index "${conversation.title}":`, error);
					progress.failed++;
				}
			}));

			onProgress?.(progress);

			// Delay between batches to avoid overwhelming the system
			if (i + batchSize < allConversations.length && !migrationAborted) {
				await delay(batchDelay);
			}
		}

		progress.isRunning = false;
		progress.currentConversation = null;
		onProgress?.(progress);

		console.log(`[ChatIndexMigration] Migration complete: ${progress.indexed} indexed, ${progress.skipped} skipped, ${progress.failed} failed`);

		return progress;
	} finally {
		migrationInProgress = false;
	}
}

/**
 * Abort the current migration
 */
export function abortChatIndexMigration(): void {
	migrationAborted = true;
}

/**
 * Check if migration is currently running
 */
export function isMigrationRunning(): boolean {
	return migrationInProgress;
}

/**
 * Get migration statistics
 */
export async function getMigrationStats(): Promise<{
	totalConversations: number;
	indexedConversations: number;
	pendingConversations: number;
}> {
	const [allConversations, indexedConversationIds] = await Promise.all([
		db.conversations.count(),
		db.chatChunks.orderBy('conversationId').uniqueKeys()
	]);

	const indexedCount = (indexedConversationIds as string[]).length;

	return {
		totalConversations: allConversations,
		indexedConversations: indexedCount,
		pendingConversations: allConversations - indexedCount
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get messages from a conversation in the format needed for indexing
 */
async function getMessagesForIndexing(conversationId: string): Promise<Message[]> {
	const storedMessages = await db.messages
		.where('conversationId')
		.equals(conversationId)
		.toArray();

	// Convert to Message format expected by indexer
	return storedMessages.map(m => ({
		role: m.role,
		content: m.content,
		images: m.images,
		toolCalls: m.toolCalls,
		hidden: false
	}));
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Auto-run migration on module load (deferred)
 * This ensures migration runs in the background after the app has loaded
 */
export function scheduleMigration(delayMs: number = 3000): void {
	if (typeof window === 'undefined') return; // SSR guard

	setTimeout(() => {
		runChatIndexMigration({
			batchSize: 2,
			batchDelay: 1000, // 1 second between batches
			minMessages: 2,
			embeddingModel: settingsState.embeddingModel,
			onProgress: (progress) => {
				// Only log significant events
				if (progress.indexed > 0 && progress.indexed % 5 === 0) {
					console.log(`[ChatIndexMigration] Progress: ${progress.indexed}/${progress.total} indexed`);
				}
			}
		}).catch(error => {
			console.error('[ChatIndexMigration] Migration failed:', error);
		});
	}, delayMs);
}
