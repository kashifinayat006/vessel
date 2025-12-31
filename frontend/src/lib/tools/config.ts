/**
 * Tool system configuration
 *
 * Defines preferred models for function calling and tool execution.
 */

/**
 * Preferred model for function/tool calling
 * functiongemma acts as a middle layer to determine when and how to call tools
 */
export const PREFERRED_FUNCTION_MODEL = 'functiongemma:latest';

/**
 * Whether to use a dedicated function model for tool routing
 * When true, functiongemma processes the request first to decide on tool usage
 * When false, tools are passed directly to the selected model
 */
export const USE_FUNCTION_MODEL = false; // Set to true only if using functiongemma as middleware

/**
 * Get the model to use for function calling
 * Returns the preferred function model if available, otherwise falls back
 * to the provided model
 */
export function getFunctionModel(fallbackModel: string): string {
	// In production, you'd check if functiongemma is available
	// For now, just return the fallback (selected model) directly
	if (USE_FUNCTION_MODEL) {
		return PREFERRED_FUNCTION_MODEL;
	}
	return fallbackModel;
}

/**
 * Tool calling configuration
 */
export interface ToolConfig {
	/** Whether tools are globally enabled */
	enabled: boolean;
	/** Model to use for function calling (null = use selected model) */
	functionModel: string | null;
	/** Max tool call depth (prevent infinite loops) */
	maxToolCallDepth: number;
	/** Timeout for individual tool execution (ms) */
	toolTimeout: number;
}

/**
 * Default tool configuration
 */
export const defaultToolConfig: ToolConfig = {
	enabled: true,
	functionModel: null, // null = use selected model, set to PREFERRED_FUNCTION_MODEL to use functiongemma
	maxToolCallDepth: 5,
	toolTimeout: 30000
};
