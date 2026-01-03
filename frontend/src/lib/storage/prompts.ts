/**
 * System prompts storage operations
 * CRUD operations for prompt templates
 */

import { db, generateId, withErrorHandling, type StorageResult, type StoredPrompt } from './db.js';

/**
 * Get all prompts, sorted by updatedAt descending
 */
export async function getAllPrompts(): Promise<StorageResult<StoredPrompt[]>> {
	return withErrorHandling(async () => {
		return db.prompts.orderBy('updatedAt').reverse().toArray();
	});
}

/**
 * Get the default prompt (if any)
 */
export async function getDefaultPrompt(): Promise<StorageResult<StoredPrompt | null>> {
	return withErrorHandling(async () => {
		const prompt = await db.prompts.where('isDefault').equals(1).first();
		return prompt ?? null;
	});
}

/**
 * Get a prompt by ID
 */
export async function getPrompt(id: string): Promise<StorageResult<StoredPrompt | null>> {
	return withErrorHandling(async () => {
		const prompt = await db.prompts.get(id);
		return prompt ?? null;
	});
}

/**
 * Create a new prompt
 */
export async function createPrompt(data: {
	name: string;
	content: string;
	description?: string;
	isDefault?: boolean;
	targetCapabilities?: string[];
}): Promise<StorageResult<StoredPrompt>> {
	return withErrorHandling(async () => {
		const now = Date.now();
		const prompt: StoredPrompt = {
			id: generateId(),
			name: data.name,
			content: data.content,
			description: data.description ?? '',
			isDefault: data.isDefault ?? false,
			targetCapabilities: data.targetCapabilities,
			createdAt: now,
			updatedAt: now
		};

		// If this is set as default, clear other defaults
		if (prompt.isDefault) {
			await db.prompts.where('isDefault').equals(1).modify({ isDefault: false });
		}

		await db.prompts.add(prompt);
		return prompt;
	});
}

/**
 * Update an existing prompt
 */
export async function updatePrompt(
	id: string,
	updates: Partial<Omit<StoredPrompt, 'id' | 'createdAt'>>
): Promise<StorageResult<StoredPrompt>> {
	return withErrorHandling(async () => {
		const existing = await db.prompts.get(id);
		if (!existing) {
			throw new Error(`Prompt not found: ${id}`);
		}

		// If setting as default, clear other defaults
		if (updates.isDefault === true) {
			await db.prompts.where('isDefault').equals(1).modify({ isDefault: false });
		}

		const updated: StoredPrompt = {
			...existing,
			...updates,
			updatedAt: Date.now()
		};

		await db.prompts.put(updated);
		return updated;
	});
}

/**
 * Delete a prompt
 */
export async function deletePrompt(id: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.prompts.delete(id);
	});
}

/**
 * Set a prompt as the default
 */
export async function setDefaultPrompt(id: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		// Clear existing defaults
		await db.prompts.where('isDefault').equals(1).modify({ isDefault: false });
		// Set new default
		await db.prompts.update(id, { isDefault: true, updatedAt: Date.now() });
	});
}

/**
 * Clear the default prompt (no default)
 */
export async function clearDefaultPrompt(): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.prompts.where('isDefault').equals(1).modify({ isDefault: false });
	});
}

/**
 * Search prompts by name
 */
export async function searchPrompts(query: string): Promise<StorageResult<StoredPrompt[]>> {
	return withErrorHandling(async () => {
		const lowerQuery = query.toLowerCase();
		return db.prompts
			.filter(prompt =>
				prompt.name.toLowerCase().includes(lowerQuery) ||
				prompt.description.toLowerCase().includes(lowerQuery)
			)
			.toArray();
	});
}
