/**
 * Model-prompt mappings state management using Svelte 5 runes.
 *
 * Manages user-configured default prompts for specific models.
 * When a model is used, its mapped prompt takes priority over the global default.
 */

import {
	getAllModelPromptMappings,
	setModelPromptMapping,
	removeModelPromptMapping,
	type StoredModelPromptMapping
} from '$lib/storage/model-prompt-mappings.js';

/**
 * Model-prompt mappings state class with reactive properties.
 */
class ModelPromptMappingsState {
	/** Map of model name to prompt ID */
	mappings = $state<Map<string, string>>(new Map());

	/** Loading state */
	isLoading = $state(false);

	/** Error state */
	error = $state<string | null>(null);

	/** Promise that resolves when initial load is complete */
	private _readyPromise: Promise<void> | null = null;
	private _readyResolve: (() => void) | null = null;

	constructor() {
		// Create ready promise
		this._readyPromise = new Promise((resolve) => {
			this._readyResolve = resolve;
		});

		// Load mappings on initialization (client-side only)
		if (typeof window !== 'undefined') {
			this.load();
		}
	}

	/**
	 * Wait for initial load to complete.
	 */
	async ready(): Promise<void> {
		return this._readyPromise ?? Promise.resolve();
	}

	/**
	 * Load all mappings from storage.
	 */
	async load(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			const result = await getAllModelPromptMappings();
			if (result.success) {
				this.mappings = new Map(result.data.map((m) => [m.modelName, m.promptId]));
			} else {
				this.error = result.error;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load model-prompt mappings';
		} finally {
			this.isLoading = false;
			this._readyResolve?.();
		}
	}

	/**
	 * Get the prompt ID mapped to a model.
	 *
	 * @param modelName - Ollama model name
	 * @returns Prompt ID or undefined if not mapped
	 */
	getMapping(modelName: string): string | undefined {
		return this.mappings.get(modelName);
	}

	/**
	 * Check if a model has a prompt mapping.
	 *
	 * @param modelName - Ollama model name
	 * @returns true if model has a mapping
	 */
	hasMapping(modelName: string): boolean {
		return this.mappings.has(modelName);
	}

	/**
	 * Set or update the prompt mapping for a model.
	 *
	 * @param modelName - Ollama model name
	 * @param promptId - Prompt ID to map to
	 * @returns true if successful
	 */
	async setMapping(modelName: string, promptId: string): Promise<boolean> {
		const result = await setModelPromptMapping(modelName, promptId);
		if (result.success) {
			// Update local state
			const newMap = new Map(this.mappings);
			newMap.set(modelName, promptId);
			this.mappings = newMap;
			return true;
		}
		this.error = result.error;
		return false;
	}

	/**
	 * Remove the prompt mapping for a model.
	 *
	 * @param modelName - Ollama model name
	 * @returns true if successful
	 */
	async removeMapping(modelName: string): Promise<boolean> {
		const result = await removeModelPromptMapping(modelName);
		if (result.success) {
			// Update local state
			const newMap = new Map(this.mappings);
			newMap.delete(modelName);
			this.mappings = newMap;
			return true;
		}
		this.error = result.error;
		return false;
	}

	/**
	 * Get all mappings as an array.
	 *
	 * @returns Array of [modelName, promptId] pairs
	 */
	getAllMappings(): Array<[string, string]> {
		return Array.from(this.mappings.entries());
	}

	/**
	 * Get number of configured mappings.
	 */
	get count(): number {
		return this.mappings.size;
	}
}

/** Singleton instance */
export const modelPromptMappingsState = new ModelPromptMappingsState();
