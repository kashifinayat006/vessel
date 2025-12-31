/**
 * Model context window limits database
 *
 * Maps model name patterns to their context window sizes.
 * This helps track context usage and warn users before hitting limits.
 */

/** Model pattern to context window size mapping */
const MODEL_CONTEXT_LIMITS: Array<{ pattern: RegExp; contextLength: number }> = [
	// Llama 3.2 models
	{ pattern: /llama3\.2/i, contextLength: 128000 },
	{ pattern: /llama-3\.2/i, contextLength: 128000 },

	// Llama 3.1 models (128K context)
	{ pattern: /llama3\.1/i, contextLength: 128000 },
	{ pattern: /llama-3\.1/i, contextLength: 128000 },
	{ pattern: /llama3:.*-instruct/i, contextLength: 128000 },

	// Llama 3 base models (8K context)
	{ pattern: /llama3(?!\.)/i, contextLength: 8192 },
	{ pattern: /llama-3(?!\.)/i, contextLength: 8192 },

	// Llama 2 models (4K context)
	{ pattern: /llama2/i, contextLength: 4096 },
	{ pattern: /llama-2/i, contextLength: 4096 },

	// Mistral models
	{ pattern: /mistral-large/i, contextLength: 128000 },
	{ pattern: /mistral-medium/i, contextLength: 32000 },
	{ pattern: /mistral.*nemo/i, contextLength: 128000 },
	{ pattern: /mistral/i, contextLength: 32000 },

	// Mixtral models
	{ pattern: /mixtral/i, contextLength: 32000 },

	// Qwen models
	{ pattern: /qwen2\.5/i, contextLength: 128000 },
	{ pattern: /qwen2/i, contextLength: 32000 },
	{ pattern: /qwen/i, contextLength: 8192 },

	// Phi models
	{ pattern: /phi-3/i, contextLength: 128000 },
	{ pattern: /phi-2/i, contextLength: 2048 },
	{ pattern: /phi/i, contextLength: 4096 },

	// Gemma models
	{ pattern: /gemma2/i, contextLength: 8192 },
	{ pattern: /gemma/i, contextLength: 8192 },

	// CodeLlama models
	{ pattern: /codellama/i, contextLength: 16384 },

	// DeepSeek models
	{ pattern: /deepseek.*coder/i, contextLength: 16384 },
	{ pattern: /deepseek/i, contextLength: 32000 },

	// Vicuna models
	{ pattern: /vicuna/i, contextLength: 4096 },

	// Yi models
	{ pattern: /yi/i, contextLength: 200000 },

	// Command models (Cohere)
	{ pattern: /command-r/i, contextLength: 128000 },

	// LLaVA vision models
	{ pattern: /llava/i, contextLength: 4096 },
	{ pattern: /bakllava/i, contextLength: 4096 },

	// Orca models
	{ pattern: /orca/i, contextLength: 4096 },

	// Nous Hermes
	{ pattern: /nous-hermes/i, contextLength: 8192 },

	// OpenHermes
	{ pattern: /openhermes/i, contextLength: 8192 },

	// Neural Chat
	{ pattern: /neural-chat/i, contextLength: 8192 },

	// Starling
	{ pattern: /starling/i, contextLength: 8192 },

	// Dolphin models
	{ pattern: /dolphin/i, contextLength: 16384 },

	// Zephyr
	{ pattern: /zephyr/i, contextLength: 32000 }
];

/** Default context length if model not recognized */
const DEFAULT_CONTEXT_LENGTH = 4096;

/**
 * Get the context window size for a model
 * @param modelName The model name (e.g., "llama3.1:8b", "mistral:latest")
 * @returns The context window size in tokens
 */
export function getModelContextLimit(modelName: string): number {
	const normalized = modelName.toLowerCase();

	for (const { pattern, contextLength } of MODEL_CONTEXT_LIMITS) {
		if (pattern.test(normalized)) {
			return contextLength;
		}
	}

	return DEFAULT_CONTEXT_LENGTH;
}

/**
 * Check if a model likely supports tool calling
 * Based on model capabilities documentation
 */
export function modelSupportsTools(modelName: string): boolean {
	const normalized = modelName.toLowerCase();

	const toolSupportPatterns = [
		/llama3\.1/i,
		/llama3\.2/i,
		/llama-3\.1/i,
		/llama-3\.2/i,
		/mistral.*7b/i,
		/mistral-large/i,
		/mistral.*nemo/i,
		/mixtral/i,
		/command-r/i,
		/qwen2/i,
		/deepseek/i
	];

	return toolSupportPatterns.some((p) => p.test(normalized));
}

/**
 * Check if a model supports vision (image input)
 */
export function modelSupportsVision(modelName: string): boolean {
	const normalized = modelName.toLowerCase();

	const visionPatterns = [
		/llava/i,
		/bakllava/i,
		/llama3\.2.*vision/i,
		/moondream/i,
		/minicpm.*v/i
	];

	return visionPatterns.some((p) => p.test(normalized));
}

/**
 * Get human-readable context size description
 */
export function formatContextSize(tokens: number): string {
	if (tokens >= 100000) {
		return `${Math.round(tokens / 1000)}K`;
	}
	if (tokens >= 1000) {
		return `${(tokens / 1000).toFixed(0)}K`;
	}
	return tokens.toString();
}
