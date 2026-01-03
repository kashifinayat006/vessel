/**
 * Storage operations for model-prompt mappings.
 *
 * Allows users to configure default system prompts for specific models.
 * When a model is used, its mapped prompt takes priority over the global default.
 */

import {
	db,
	generateId,
	withErrorHandling,
	type StorageResult,
	type StoredModelPromptMapping
} from './db.js';

// Re-export the type for consumers
export type { StoredModelPromptMapping };

/**
 * Get the prompt mapping for a specific model.
 *
 * @param modelName - Ollama model name (e.g., "llama3.2:8b")
 * @returns The mapping if found, null otherwise
 */
export async function getModelPromptMapping(
	modelName: string
): Promise<StorageResult<StoredModelPromptMapping | null>> {
	return withErrorHandling(async () => {
		const mapping = await db.modelPromptMappings.where('modelName').equals(modelName).first();
		return mapping ?? null;
	});
}

/**
 * Get all model-prompt mappings.
 *
 * @returns Array of all mappings
 */
export async function getAllModelPromptMappings(): Promise<
	StorageResult<StoredModelPromptMapping[]>
> {
	return withErrorHandling(async () => {
		return db.modelPromptMappings.toArray();
	});
}

/**
 * Set or update the prompt mapping for a model.
 * Pass null for promptId to remove the mapping.
 *
 * @param modelName - Ollama model name
 * @param promptId - Prompt ID to map to, or null to remove mapping
 */
export async function setModelPromptMapping(
	modelName: string,
	promptId: string | null
): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		if (promptId === null) {
			// Remove mapping
			await db.modelPromptMappings.where('modelName').equals(modelName).delete();
		} else {
			// Upsert mapping
			const existing = await db.modelPromptMappings.where('modelName').equals(modelName).first();

			const now = Date.now();
			if (existing) {
				await db.modelPromptMappings.update(existing.id, {
					promptId,
					updatedAt: now
				});
			} else {
				await db.modelPromptMappings.add({
					id: generateId(),
					modelName,
					promptId,
					createdAt: now,
					updatedAt: now
				});
			}
		}
	});
}

/**
 * Remove the prompt mapping for a model.
 *
 * @param modelName - Ollama model name
 */
export async function removeModelPromptMapping(modelName: string): Promise<StorageResult<void>> {
	return setModelPromptMapping(modelName, null);
}

/**
 * Get mappings for multiple models at once.
 * Useful for batch operations.
 *
 * @param modelNames - Array of model names
 * @returns Map of model name to prompt ID
 */
export async function getModelPromptMappingsBatch(
	modelNames: string[]
): Promise<StorageResult<Map<string, string>>> {
	return withErrorHandling(async () => {
		const mappings = await db.modelPromptMappings
			.where('modelName')
			.anyOf(modelNames)
			.toArray();

		const result = new Map<string, string>();
		for (const mapping of mappings) {
			result.set(mapping.modelName, mapping.promptId);
		}
		return result;
	});
}

/**
 * Clear all model-prompt mappings.
 */
export async function clearAllModelPromptMappings(): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.modelPromptMappings.clear();
	});
}
