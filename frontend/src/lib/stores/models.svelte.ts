/**
 * Models state management using Svelte 5 runes
 * Handles available models, selection, and categorization
 */

import type { OllamaModel, ModelGroup } from '$lib/types/model.js';

/** Known vision model families/patterns */
const VISION_PATTERNS = ['llava', 'bakllava', 'moondream', 'vision'];

/**
 * Middleware models that should NOT appear in the chat model selector
 * These are special-purpose models for embeddings, function routing, etc.
 */
const MIDDLEWARE_MODEL_PATTERNS = [
	'embeddinggemma',
	'functiongemma',
	'nomic-embed',
	'mxbai-embed',
	'all-minilm',
	'snowflake-arctic-embed',
	'bge-',        // BGE embedding models
	'e5-',         // E5 embedding models
	'gte-',        // GTE embedding models
	'embed'        // Generic embed pattern (catches most embedding models)
];

/** Check if a model is a middleware/utility model (not for direct chat) */
function isMiddlewareModel(model: OllamaModel): boolean {
	const name = model.name.toLowerCase();
	return MIDDLEWARE_MODEL_PATTERNS.some((pattern) => name.includes(pattern));
}

/** Check if a model supports vision */
function isVisionModel(model: OllamaModel): boolean {
	const name = model.name.toLowerCase();
	const family = model.details.family.toLowerCase();
	const families = model.details.families?.map((f) => f.toLowerCase()) ?? [];

	return (
		VISION_PATTERNS.some((pattern) => name.includes(pattern)) ||
		VISION_PATTERNS.some((pattern) => family.includes(pattern)) ||
		families.some((f) => VISION_PATTERNS.some((pattern) => f.includes(pattern)))
	);
}

/** Models state class with reactive properties */
export class ModelsState {
	// Core state
	available = $state<OllamaModel[]>([]);
	selectedId = $state<string | null>(null);
	isLoading = $state(false);
	error = $state<string | null>(null);

	// Derived: Currently selected model
	selected = $derived.by(() => {
		if (!this.selectedId) return null;
		return this.available.find((m) => m.name === this.selectedId) ?? null;
	});

	// Derived: Models eligible for chat (excludes middleware models)
	chatModels = $derived.by(() => {
		return this.available.filter((m) => !isMiddlewareModel(m));
	});

	// Derived: Middleware models (for internal use only)
	middlewareModels = $derived.by(() => {
		return this.available.filter(isMiddlewareModel);
	});

	// Derived: Models grouped by family (only chat-eligible models)
	grouped = $derived.by(() => {
		const groups = new Map<string, OllamaModel[]>();

		// Only include chat-eligible models in the selector
		for (const model of this.chatModels) {
			const family = model.details.family || 'Unknown';
			if (!groups.has(family)) {
				groups.set(family, []);
			}
			groups.get(family)!.push(model);
		}

		// Sort groups alphabetically, sort models within each group by name
		const result: ModelGroup[] = [];
		const sortedFamilies = Array.from(groups.keys()).sort();

		for (const family of sortedFamilies) {
			const models = groups.get(family)!.sort((a, b) => a.name.localeCompare(b.name));
			result.push({ family, models });
		}

		return result;
	});

	// Derived: Vision-capable models
	visionModels = $derived.by(() => {
		return this.available.filter(isVisionModel);
	});

	// Derived: Check if selected model supports vision
	selectedSupportsVision = $derived.by(() => {
		if (!this.selected) return false;
		return isVisionModel(this.selected);
	});

	/**
	 * Refresh the list of available models from Ollama API
	 * Uses proxied /api path by default (vite.config.ts proxies to Ollama)
	 * @param apiBaseUrl The API base URL (default: empty for proxied path)
	 */
	async refresh(apiBaseUrl = ''): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			const response = await fetch(`${apiBaseUrl}/api/tags`);

			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			this.available = data.models ?? [];

			// Get chat-eligible models (exclude middleware)
			const chatEligible = this.available.filter((m) => !isMiddlewareModel(m));

			// Auto-select first chat model if none selected
			if (!this.selectedId && chatEligible.length > 0) {
				this.selectedId = chatEligible[0].name;
			}

			// Clear selection if selected model no longer exists or is middleware
			if (this.selectedId) {
				const selectedModel = this.available.find((m) => m.name === this.selectedId);
				if (!selectedModel || isMiddlewareModel(selectedModel)) {
					this.selectedId = chatEligible.length > 0 ? chatEligible[0].name : null;
				}
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Unknown error fetching models';
			console.error('Failed to refresh models:', err);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Select a model by name (only allows chat-eligible models)
	 * Persists selection to localStorage
	 * @param modelName The model name to select
	 */
	select(modelName: string): void {
		const model = this.available.find((m) => m.name === modelName);
		if (model && !isMiddlewareModel(model)) {
			this.selectedId = modelName;
			// Persist selection
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('selectedModel', modelName);
			}
		}
	}

	/**
	 * Load persisted model selection from localStorage
	 * Call this after models are loaded
	 */
	loadPersistedSelection(): void {
		if (typeof localStorage === 'undefined') return;

		const savedModel = localStorage.getItem('selectedModel');
		if (savedModel && this.hasModel(savedModel) && this.isChatModel(savedModel)) {
			this.selectedId = savedModel;
		}
	}

	/**
	 * Check if a model is available for chat (not middleware)
	 * @param modelName The model name to check
	 */
	isChatModel(modelName: string): boolean {
		const model = this.available.find((m) => m.name === modelName);
		return model ? !isMiddlewareModel(model) : false;
	}

	/**
	 * Clear the current selection
	 */
	clearSelection(): void {
		this.selectedId = null;
	}

	/**
	 * Get a model by name
	 * @param modelName The model name to find
	 */
	getByName(modelName: string): OllamaModel | undefined {
		return this.available.find((m) => m.name === modelName);
	}

	/**
	 * Check if a specific model is available
	 * @param modelName The model name to check
	 */
	hasModel(modelName: string): boolean {
		return this.available.some((m) => m.name === modelName);
	}
}

/** Singleton models state instance */
export const modelsState = new ModelsState();
