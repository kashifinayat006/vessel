/**
 * Model Info Service
 *
 * Fetches and caches model information from Ollama, including:
 * - Embedded system prompts (from Modelfile SYSTEM directive)
 * - Model capabilities (vision, code, thinking, tools, etc.)
 *
 * Uses IndexedDB for persistent caching with configurable TTL.
 */

import { ollamaClient } from '$lib/ollama/client.js';
import { parseSystemPromptFromModelfile } from '$lib/ollama/modelfile-parser.js';
import type { OllamaCapability } from '$lib/ollama/types.js';
import { db, type StoredModelSystemPrompt } from '$lib/storage/db.js';

/** Cache TTL in milliseconds (1 hour) */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Model info returned by the service */
export interface ModelInfo {
	modelName: string;
	systemPrompt: string | null;
	capabilities: OllamaCapability[];
	extractedAt: number;
}

/**
 * Service for fetching and caching model information.
 * Singleton pattern with in-flight request deduplication.
 */
class ModelInfoService {
	/** Track in-flight fetches to prevent duplicate requests */
	private fetchingModels = new Map<string, Promise<ModelInfo>>();

	/**
	 * Get model info, fetching from Ollama if not cached or expired.
	 *
	 * @param modelName - Ollama model name (e.g., "llama3.2:8b")
	 * @param forceRefresh - Skip cache and fetch fresh data
	 * @returns Model info including embedded system prompt and capabilities
	 */
	async getModelInfo(modelName: string, forceRefresh = false): Promise<ModelInfo> {
		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cached = await this.getCached(modelName);
			if (cached && Date.now() - cached.extractedAt < CACHE_TTL_MS) {
				return {
					modelName: cached.modelName,
					systemPrompt: cached.systemPrompt,
					capabilities: cached.capabilities as OllamaCapability[],
					extractedAt: cached.extractedAt
				};
			}
		}

		// Check if already fetching this model (deduplication)
		const existingFetch = this.fetchingModels.get(modelName);
		if (existingFetch) {
			return existingFetch;
		}

		// Create new fetch promise
		const fetchPromise = this.fetchAndCache(modelName);
		this.fetchingModels.set(modelName, fetchPromise);

		try {
			return await fetchPromise;
		} finally {
			this.fetchingModels.delete(modelName);
		}
	}

	/**
	 * Fetch model info from Ollama and cache it.
	 */
	private async fetchAndCache(modelName: string): Promise<ModelInfo> {
		try {
			const response = await ollamaClient.showModel(modelName);
			const systemPrompt = parseSystemPromptFromModelfile(response.modelfile);
			const capabilities = (response.capabilities ?? []) as OllamaCapability[];
			const extractedAt = Date.now();

			const record: StoredModelSystemPrompt = {
				modelName,
				systemPrompt,
				capabilities,
				extractedAt
			};

			// Cache in IndexedDB
			await db.modelSystemPrompts.put(record);

			return {
				modelName,
				systemPrompt,
				capabilities,
				extractedAt
			};
		} catch (error) {
			console.error(`[ModelInfoService] Failed to fetch info for ${modelName}:`, error);

			// Return cached data if available (even if expired)
			const cached = await this.getCached(modelName);
			if (cached) {
				return {
					modelName: cached.modelName,
					systemPrompt: cached.systemPrompt,
					capabilities: cached.capabilities as OllamaCapability[],
					extractedAt: cached.extractedAt
				};
			}

			// Return empty info if no cache
			return {
				modelName,
				systemPrompt: null,
				capabilities: [],
				extractedAt: 0
			};
		}
	}

	/**
	 * Get cached model info from IndexedDB.
	 */
	private async getCached(modelName: string): Promise<StoredModelSystemPrompt | undefined> {
		try {
			return await db.modelSystemPrompts.get(modelName);
		} catch (error) {
			console.error(`[ModelInfoService] Cache read error for ${modelName}:`, error);
			return undefined;
		}
	}

	/**
	 * Check if a model has an embedded system prompt.
	 *
	 * @param modelName - Ollama model name
	 * @returns true if model has embedded system prompt
	 */
	async hasEmbeddedPrompt(modelName: string): Promise<boolean> {
		const info = await this.getModelInfo(modelName);
		return info.systemPrompt !== null;
	}

	/**
	 * Get the embedded system prompt for a model.
	 *
	 * @param modelName - Ollama model name
	 * @returns Embedded system prompt or null
	 */
	async getEmbeddedPrompt(modelName: string): Promise<string | null> {
		const info = await this.getModelInfo(modelName);
		return info.systemPrompt;
	}

	/**
	 * Get capabilities for a model.
	 *
	 * @param modelName - Ollama model name
	 * @returns Array of capability strings
	 */
	async getCapabilities(modelName: string): Promise<OllamaCapability[]> {
		const info = await this.getModelInfo(modelName);
		return info.capabilities;
	}

	/**
	 * Pre-fetch info for multiple models in parallel.
	 * Useful for warming the cache on app startup.
	 *
	 * @param modelNames - Array of model names to fetch
	 */
	async prefetchModels(modelNames: string[]): Promise<void> {
		await Promise.allSettled(modelNames.map((name) => this.getModelInfo(name)));
	}

	/**
	 * Clear cached info for a model.
	 *
	 * @param modelName - Ollama model name
	 */
	async clearCache(modelName: string): Promise<void> {
		try {
			await db.modelSystemPrompts.delete(modelName);
		} catch (error) {
			console.error(`[ModelInfoService] Failed to clear cache for ${modelName}:`, error);
		}
	}

	/**
	 * Clear all cached model info.
	 */
	async clearAllCache(): Promise<void> {
		try {
			await db.modelSystemPrompts.clear();
		} catch (error) {
			console.error('[ModelInfoService] Failed to clear all cache:', error);
		}
	}
}

/** Singleton instance */
export const modelInfoService = new ModelInfoService();
