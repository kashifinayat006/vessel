/**
 * Model creation/editing state management using Svelte 5 runes
 * Handles creating custom Ollama models with embedded system prompts
 */

import { ollamaClient } from '$lib/ollama';
import type { OllamaCreateProgress } from '$lib/ollama/types.js';
import { modelsState } from './models.svelte.js';
import { modelInfoService } from '$lib/services/model-info-service.js';

/** Mode of the model editor */
export type ModelEditorMode = 'create' | 'edit';

/** Model creation state class with reactive properties */
class ModelCreationState {
	/** Whether a creation/update operation is in progress */
	isCreating = $state(false);

	/** Current status message from Ollama */
	status = $state('');

	/** Error message if creation failed */
	error = $state<string | null>(null);

	/** Abort controller for cancelling operations */
	private abortController: AbortController | null = null;

	/**
	 * Create a new custom model with an embedded system prompt
	 * @param modelName Name for the new model
	 * @param baseModel Base model to derive from (e.g., "llama3.2:8b")
	 * @param systemPrompt System prompt to embed
	 * @returns true if successful, false otherwise
	 */
	async create(
		modelName: string,
		baseModel: string,
		systemPrompt: string
	): Promise<boolean> {
		if (this.isCreating) return false;

		this.isCreating = true;
		this.status = 'Initializing...';
		this.error = null;
		this.abortController = new AbortController();

		try {
			await ollamaClient.createModel(
				{
					model: modelName,
					from: baseModel,
					system: systemPrompt
				},
				(progress: OllamaCreateProgress) => {
					this.status = progress.status;
				},
				this.abortController.signal
			);

			// Refresh models list to show the new model
			await modelsState.refresh();

			// Clear the model info cache for this model so it gets fresh info
			modelInfoService.clearCache(modelName);

			this.status = 'Success!';
			return true;
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				this.error = 'Operation cancelled';
			} else {
				this.error = err instanceof Error ? err.message : 'Failed to create model';
			}
			return false;
		} finally {
			this.isCreating = false;
			this.abortController = null;
		}
	}

	/**
	 * Update an existing model's system prompt
	 * Note: This re-creates the model with the new prompt (Ollama limitation)
	 * @param modelName Name of the existing model
	 * @param baseModel Base model (usually the model's parent or itself)
	 * @param systemPrompt New system prompt
	 * @returns true if successful, false otherwise
	 */
	async update(
		modelName: string,
		baseModel: string,
		systemPrompt: string
	): Promise<boolean> {
		// Updating is the same as creating with the same name
		// Ollama will overwrite the existing model
		return this.create(modelName, baseModel, systemPrompt);
	}

	/**
	 * Cancel the current operation
	 */
	cancel(): void {
		if (this.abortController) {
			this.abortController.abort();
		}
	}

	/**
	 * Reset the state
	 */
	reset(): void {
		this.isCreating = false;
		this.status = '';
		this.error = null;
		this.abortController = null;
	}
}

/** Singleton model creation state instance */
export const modelCreationState = new ModelCreationState();
