/**
 * Sync Manager - Coordinates synchronization between IndexedDB and backend
 * Implements offline-first pattern with periodic sync
 */

import { backendClient } from './client.js';
import type { BackendChat, BackendMessage } from './types.js';
import {
	getPendingSyncItems,
	clearSyncItems,
	incrementRetryCount,
	type SyncEntityType,
	type SyncOperation
} from '../storage/sync.js';
import { db } from '../storage/db.js';
import type { StoredConversation, StoredMessage } from '../storage/db.js';

/** Sync manager configuration */
export interface SyncManagerConfig {
	/** Interval between sync attempts in milliseconds (default: 30 seconds) */
	syncInterval?: number;
	/** Whether to enable auto-sync (default: true) */
	autoSync?: boolean;
	/** Maximum retries for failed sync items (default: 5) */
	maxRetries?: number;
}

/** Sync status */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

/** Sync result */
export interface SyncResult {
	pushed: number;
	pulled: number;
	errors: string[];
}

/** Sync state using Svelte 5 runes */
class SyncManagerState {
	status = $state<SyncStatus>('idle');
	lastSyncTime = $state<Date | null>(null);
	lastSyncVersion = $state<number>(0);
	pendingCount = $state<number>(0);
	isOnline = $state<boolean>(true);
	lastError = $state<string | null>(null);
}

export const syncState = new SyncManagerState();

/** Sync manager singleton */
class SyncManager {
	private config: Required<SyncManagerConfig>;
	private syncIntervalId: ReturnType<typeof setInterval> | null = null;
	private isSyncing = false;

	// Bound function references for proper cleanup
	private boundHandleOnline: () => void;
	private boundHandleOffline: () => void;

	constructor(config: SyncManagerConfig = {}) {
		this.config = {
			syncInterval: config.syncInterval ?? 30000,
			autoSync: config.autoSync ?? true,
			maxRetries: config.maxRetries ?? 5
		};

		// Bind handlers once for proper add/remove
		this.boundHandleOnline = this.handleOnline.bind(this);
		this.boundHandleOffline = this.handleOffline.bind(this);
	}

	/**
	 * Initialize the sync manager
	 * Call this once when the app starts (in browser only)
	 */
	async initialize(): Promise<void> {
		if (typeof window === 'undefined') return;

		// Check online status
		syncState.isOnline = navigator.onLine;

		// Listen for online/offline events
		window.addEventListener('online', this.boundHandleOnline);
		window.addEventListener('offline', this.boundHandleOffline);

		// Load last sync version from localStorage
		const savedVersion = localStorage.getItem('lastSyncVersion');
		if (savedVersion) {
			syncState.lastSyncVersion = parseInt(savedVersion, 10);
		}

		// Update pending count
		await this.updatePendingCount();

		// Check backend connectivity
		const isHealthy = await backendClient.healthCheck();
		if (!isHealthy) {
			console.warn('Backend not reachable - sync disabled until connection restored');
			syncState.lastError = 'Backend not reachable';
		}

		// Start auto-sync if enabled
		if (this.config.autoSync && isHealthy) {
			this.startAutoSync();
		}
	}

	/**
	 * Stop the sync manager and clean up
	 */
	destroy(): void {
		this.stopAutoSync();
		if (typeof window !== 'undefined') {
			window.removeEventListener('online', this.boundHandleOnline);
			window.removeEventListener('offline', this.boundHandleOffline);
		}
	}

	/**
	 * Handle online event
	 */
	private handleOnline(): void {
		syncState.isOnline = true;
		syncState.status = 'idle';
		// Trigger sync when coming back online
		this.sync();
	}

	/**
	 * Handle offline event
	 */
	private handleOffline(): void {
		syncState.isOnline = false;
		syncState.status = 'offline';
	}

	/**
	 * Start automatic sync interval
	 */
	startAutoSync(): void {
		if (this.syncIntervalId) return;

		this.syncIntervalId = setInterval(() => {
			this.sync();
		}, this.config.syncInterval);

		// Also do an initial sync
		this.sync();
	}

	/**
	 * Stop automatic sync
	 */
	stopAutoSync(): void {
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
	}

	/**
	 * Perform a full sync cycle (push then pull)
	 */
	async sync(): Promise<SyncResult> {
		const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

		// Skip if already syncing or offline
		if (this.isSyncing) return result;
		if (!syncState.isOnline) {
			syncState.status = 'offline';
			return result;
		}

		this.isSyncing = true;
		syncState.status = 'syncing';
		syncState.lastError = null;

		try {
			// Push local changes first
			const pushResult = await this.pushChanges();
			result.pushed = pushResult.count;
			result.errors.push(...pushResult.errors);

			// Then pull remote changes
			const pullResult = await this.pullChanges();
			result.pulled = pullResult.count;
			result.errors.push(...pullResult.errors);

			// Update state
			syncState.lastSyncTime = new Date();
			syncState.status = result.errors.length > 0 ? 'error' : 'idle';

			if (result.errors.length > 0) {
				syncState.lastError = result.errors[0];
			}
		} catch (err) {
			syncState.status = 'error';
			syncState.lastError = err instanceof Error ? err.message : 'Unknown sync error';
			result.errors.push(syncState.lastError);
		} finally {
			this.isSyncing = false;
			await this.updatePendingCount();
		}

		return result;
	}

	/**
	 * Push local changes to backend
	 */
	private async pushChanges(): Promise<{ count: number; errors: string[] }> {
		const errors: string[] = [];

		// Get pending sync items
		const pendingResult = await getPendingSyncItems();
		if (!pendingResult.success || pendingResult.data.length === 0) {
			return { count: 0, errors: [] };
		}

		const pendingItems = pendingResult.data;

		// Group by entity type
		const conversationItems = pendingItems.filter((i) => i.entityType === 'conversation');
		const messageItems = pendingItems.filter((i) => i.entityType === 'message');

		// Collect data to push
		const chats: BackendChat[] = [];
		const messages: BackendMessage[] = [];

		// Process conversations
		for (const item of conversationItems) {
			if (item.operation === 'delete') {
				// Handle delete separately
				const response = await backendClient.deleteChat(item.entityId);
				if (response.error) {
					await incrementRetryCount(item.id, this.config.maxRetries);
					errors.push(`Failed to delete chat ${item.entityId}: ${response.error}`);
				}
			} else {
				// Get conversation from IndexedDB
				const conv = await db.conversations.get(item.entityId);
				if (conv) {
					chats.push(this.convertConversationToBackend(conv));
				}
			}
		}

		// Process messages
		for (const item of messageItems) {
			if (item.operation !== 'delete') {
				const msg = await db.messages.get(item.entityId);
				if (msg) {
					messages.push(this.convertMessageToBackend(msg));
				}
			}
		}

		// Push changes if any
		if (chats.length > 0 || messages.length > 0) {
			const response = await backendClient.pushChanges({ chats, messages });
			if (response.error) {
				errors.push(`Push failed: ${response.error}`);
				return { count: 0, errors };
			}

			// Update sync version
			if (response.data) {
				syncState.lastSyncVersion = response.data.sync_version;
				localStorage.setItem('lastSyncVersion', String(response.data.sync_version));
			}

			// Clear successful sync items
			const successfulIds = pendingItems
				.filter((i) => i.operation !== 'delete')
				.map((i) => i.id);
			await clearSyncItems(successfulIds);
		}

		return { count: chats.length + messages.length, errors };
	}

	/**
	 * Pull changes from backend
	 */
	private async pullChanges(): Promise<{ count: number; errors: string[] }> {
		const errors: string[] = [];

		const response = await backendClient.pullChanges(syncState.lastSyncVersion);
		if (response.error) {
			errors.push(`Pull failed: ${response.error}`);
			return { count: 0, errors };
		}

		if (!response.data) {
			return { count: 0, errors: [] };
		}

		const { chats, sync_version } = response.data;
		let count = 0;

		// Process pulled chats
		for (const chat of chats) {
			try {
				await this.mergeChat(chat);
				count++;
			} catch (err) {
				errors.push(`Failed to merge chat ${chat.id}: ${err}`);
			}
		}

		// Update sync version
		syncState.lastSyncVersion = sync_version;
		localStorage.setItem('lastSyncVersion', String(sync_version));

		return { count, errors };
	}

	/**
	 * Merge a backend chat into IndexedDB
	 */
	private async mergeChat(backendChat: BackendChat): Promise<void> {
		const existing = await db.conversations.get(backendChat.id);

		// Convert to local format (using numeric timestamps)
		const localConv: StoredConversation = {
			id: backendChat.id,
			title: backendChat.title,
			model: backendChat.model,
			createdAt: new Date(backendChat.created_at).getTime(),
			updatedAt: new Date(backendChat.updated_at).getTime(),
			isPinned: backendChat.pinned,
			isArchived: backendChat.archived,
			messageCount: backendChat.messages?.length ?? existing?.messageCount ?? 0,
			syncVersion: backendChat.sync_version
		};

		if (!existing || backendChat.sync_version > (existing.syncVersion ?? 0)) {
			await db.conversations.put(localConv);

			// Also merge messages if present
			if (backendChat.messages) {
				for (const msg of backendChat.messages) {
					await this.mergeMessage(msg);
				}
			}
		}
	}

	/**
	 * Merge a backend message into IndexedDB
	 */
	private async mergeMessage(backendMsg: BackendMessage): Promise<void> {
		const existing = await db.messages.get(backendMsg.id);

		const localMsg: StoredMessage = {
			id: backendMsg.id,
			conversationId: backendMsg.chat_id,
			parentId: backendMsg.parent_id ?? null,
			role: backendMsg.role,
			content: backendMsg.content,
			siblingIndex: backendMsg.sibling_index,
			createdAt: new Date(backendMsg.created_at).getTime(),
			syncVersion: backendMsg.sync_version
		};

		if (!existing || backendMsg.sync_version > (existing.syncVersion ?? 0)) {
			await db.messages.put(localMsg);
		}
	}

	/**
	 * Convert local conversation to backend format
	 */
	private convertConversationToBackend(conv: StoredConversation): BackendChat {
		return {
			id: conv.id,
			title: conv.title,
			model: conv.model,
			pinned: conv.isPinned,
			archived: conv.isArchived,
			created_at: new Date(conv.createdAt).toISOString(),
			updated_at: new Date(conv.updatedAt).toISOString(),
			sync_version: conv.syncVersion ?? 1
		};
	}

	/**
	 * Convert local message to backend format
	 */
	private convertMessageToBackend(msg: StoredMessage): BackendMessage {
		return {
			id: msg.id,
			chat_id: msg.conversationId,
			parent_id: msg.parentId,
			role: msg.role as BackendMessage['role'],
			content: msg.content,
			sibling_index: msg.siblingIndex,
			created_at: new Date(msg.createdAt).toISOString(),
			sync_version: msg.syncVersion ?? 1
		};
	}

	/**
	 * Update pending count in state
	 */
	private async updatePendingCount(): Promise<void> {
		const result = await getPendingSyncItems();
		syncState.pendingCount = result.success ? result.data.length : 0;
	}

	/**
	 * Force a sync now (manual trigger)
	 */
	async syncNow(): Promise<SyncResult> {
		return this.sync();
	}
}

/** Singleton sync manager instance */
export const syncManager = new SyncManager();
