/**
 * Sync utilities for future backend synchronization
 * Provides a queue-based system for tracking changes that need to be synced
 */

import { db, withErrorHandling, generateId } from './db.js';
import type { SyncQueueItem, StorageResult } from './db.js';

/**
 * Entity types that can be synced
 */
export type SyncEntityType = 'conversation' | 'message' | 'attachment';

/**
 * Operations that can be synced
 */
export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Mark an entity for synchronization
 * Adds an entry to the sync queue
 */
export async function markForSync(
	entityType: SyncEntityType,
	entityId: string,
	operation: SyncOperation
): Promise<StorageResult<SyncQueueItem>> {
	return withErrorHandling(async () => {
		// Check if there's already a pending sync for this entity
		const existing = await db.syncQueue
			.where('entityType')
			.equals(entityType)
			.filter((item) => item.entityId === entityId)
			.first();

		if (existing) {
			// Update the existing sync item with the new operation
			// Delete operations take precedence
			const updatedOperation = operation === 'delete' ? 'delete' : existing.operation;

			const updated: SyncQueueItem = {
				...existing,
				operation: updatedOperation,
				createdAt: Date.now()
			};

			await db.syncQueue.put(updated);
			return updated;
		}

		// Create a new sync queue item
		const item: SyncQueueItem = {
			id: generateId(),
			entityType,
			entityId,
			operation,
			createdAt: Date.now(),
			retryCount: 0
		};

		await db.syncQueue.add(item);
		return item;
	});
}

/**
 * Get all pending sync items, ordered by creation time
 */
export async function getPendingSyncItems(): Promise<StorageResult<SyncQueueItem[]>> {
	return withErrorHandling(async () => {
		const items = await db.syncQueue.orderBy('createdAt').toArray();
		return items;
	});
}

/**
 * Get pending sync items filtered by entity type
 */
export async function getPendingSyncItemsByType(
	entityType: SyncEntityType
): Promise<StorageResult<SyncQueueItem[]>> {
	return withErrorHandling(async () => {
		const items = await db.syncQueue
			.where('entityType')
			.equals(entityType)
			.sortBy('createdAt');
		return items;
	});
}

/**
 * Clear a sync item after successful synchronization
 */
export async function clearSyncItem(id: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.syncQueue.delete(id);
	});
}

/**
 * Clear multiple sync items after successful synchronization
 */
export async function clearSyncItems(ids: string[]): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.syncQueue.bulkDelete(ids);
	});
}

/**
 * Increment retry count for a failed sync item
 * Returns the updated item or null if max retries exceeded
 */
export async function incrementRetryCount(
	id: string,
	maxRetries: number = 5
): Promise<StorageResult<SyncQueueItem | null>> {
	return withErrorHandling(async () => {
		const item = await db.syncQueue.get(id);
		if (!item) {
			throw new Error(`Sync item not found: ${id}`);
		}

		const newRetryCount = item.retryCount + 1;

		if (newRetryCount > maxRetries) {
			// Max retries exceeded - remove from queue
			await db.syncQueue.delete(id);
			return null;
		}

		const updated: SyncQueueItem = {
			...item,
			retryCount: newRetryCount
		};

		await db.syncQueue.put(updated);
		return updated;
	});
}

/**
 * Clear all pending sync items
 * Use with caution - only for reset scenarios
 */
export async function clearAllSyncItems(): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.syncQueue.clear();
	});
}

/**
 * Get count of pending sync items
 */
export async function getPendingSyncCount(): Promise<StorageResult<number>> {
	return withErrorHandling(async () => {
		return await db.syncQueue.count();
	});
}

/**
 * Check if there are any pending sync items
 */
export async function hasPendingSyncs(): Promise<StorageResult<boolean>> {
	return withErrorHandling(async () => {
		const count = await db.syncQueue.count();
		return count > 0;
	});
}

/**
 * Batch operation: Mark multiple entities for sync
 */
export async function markMultipleForSync(
	items: Array<{
		entityType: SyncEntityType;
		entityId: string;
		operation: SyncOperation;
	}>
): Promise<StorageResult<SyncQueueItem[]>> {
	return withErrorHandling(async () => {
		const results: SyncQueueItem[] = [];

		for (const item of items) {
			const result = await markForSync(item.entityType, item.entityId, item.operation);
			if (result.success) {
				results.push(result.data);
			} else {
				throw new Error(`Failed to mark ${item.entityType}:${item.entityId} for sync`);
			}
		}

		return results;
	});
}
