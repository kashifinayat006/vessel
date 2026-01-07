/**
 * Settings type definitions for model parameters and chat configuration
 */

/**
 * Model generation parameters
 * Controls how the model generates responses
 */
export interface ModelParameters {
	/**
	 * Temperature controls randomness in generation
	 * Higher = more creative, lower = more focused
	 * Range: 0.0 - 2.0, Default: 0.7
	 */
	temperature: number;

	/**
	 * Top-K sampling limits vocabulary to K most likely tokens
	 * Lower = more focused, higher = more diverse
	 * Range: 1 - 100, Default: 40
	 */
	top_k: number;

	/**
	 * Top-P (nucleus) sampling limits cumulative probability
	 * Tokens with cumulative probability <= top_p are considered
	 * Range: 0.0 - 1.0, Default: 0.9
	 */
	top_p: number;

	/**
	 * Context window size in tokens
	 * Larger = more context, but slower and more memory
	 * Range: 512 - 131072, Default: 4096
	 */
	num_ctx: number;
}

/**
 * Default model parameters
 * These match Ollama's defaults
 */
export const DEFAULT_MODEL_PARAMETERS: ModelParameters = {
	temperature: 0.7,
	top_k: 40,
	top_p: 0.9,
	num_ctx: 4096
};

/**
 * Parameter ranges for validation and UI sliders
 */
export const PARAMETER_RANGES = {
	temperature: { min: 0, max: 2, step: 0.1 },
	top_k: { min: 1, max: 100, step: 1 },
	top_p: { min: 0, max: 1, step: 0.05 },
	num_ctx: { min: 512, max: 131072, step: 512 }
} as const;

/**
 * Human-readable labels for parameters
 */
export const PARAMETER_LABELS: Record<keyof ModelParameters, string> = {
	temperature: 'Temperature',
	top_k: 'Top-K',
	top_p: 'Top-P',
	num_ctx: 'Context Length'
};

/**
 * Brief descriptions for parameters
 */
export const PARAMETER_DESCRIPTIONS: Record<keyof ModelParameters, string> = {
	temperature: 'Controls randomness. Higher values make output more creative.',
	top_k: 'Limits vocabulary to top K tokens. Lower values are more focused.',
	top_p: 'Nucleus sampling threshold. Tokens within cumulative probability.',
	num_ctx: 'Context window size in tokens. Larger uses more memory.'
};

/**
 * Auto-compact settings for automatic context management
 */
export interface AutoCompactSettings {
	/** Whether auto-compact is enabled */
	enabled: boolean;

	/** Context usage threshold (percentage) to trigger auto-compact */
	threshold: number;

	/** Number of recent messages to preserve when compacting */
	preserveCount: number;
}

/**
 * Default auto-compact settings
 */
export const DEFAULT_AUTO_COMPACT_SETTINGS: AutoCompactSettings = {
	enabled: false,
	threshold: 70,
	preserveCount: 6
};

/**
 * Auto-compact parameter ranges for UI
 */
export const AUTO_COMPACT_RANGES = {
	threshold: { min: 50, max: 90, step: 5 },
	preserveCount: { min: 2, max: 20, step: 1 }
} as const;

/**
 * Chat settings including model parameters
 */
export interface ChatSettings {
	/** Whether to use custom parameters or model defaults */
	useCustomParameters: boolean;

	/** Custom model parameters (used when useCustomParameters is true) */
	modelParameters: ModelParameters;

	/** Auto-compact settings for context management */
	autoCompact?: AutoCompactSettings;

	/** Embedding model for semantic search (e.g., 'nomic-embed-text') */
	embeddingModel?: string;
}

/**
 * Default chat settings
 */
export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
	useCustomParameters: false,
	modelParameters: { ...DEFAULT_MODEL_PARAMETERS },
	autoCompact: { ...DEFAULT_AUTO_COMPACT_SETTINGS }
};
