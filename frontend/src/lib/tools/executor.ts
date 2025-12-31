/**
 * Tool Executor - Handles running tools and managing results
 */

import type {
	ToolCall,
	ParsedToolCall,
	ToolResult,
	ToolRegistryEntry,
	ToolDefinition,
	ToolContext,
	ToolCallState
} from './types.js';
import { builtinTools, getBuiltinToolDefinitions } from './builtin.js';

/**
 * Tool Registry - Manages all available tools (builtin + custom)
 */
class ToolRegistry {
	private tools: Map<string, ToolRegistryEntry> = new Map();

	constructor() {
		// Initialize with builtin tools
		for (const [name, entry] of builtinTools) {
			this.tools.set(name, entry);
		}
	}

	/**
	 * Register a custom tool
	 */
	register(name: string, entry: ToolRegistryEntry): void {
		this.tools.set(name, entry);
	}

	/**
	 * Unregister a tool
	 */
	unregister(name: string): boolean {
		const entry = this.tools.get(name);
		if (entry?.isBuiltin) {
			return false; // Cannot unregister builtin tools
		}
		return this.tools.delete(name);
	}

	/**
	 * Get a tool by name
	 */
	get(name: string): ToolRegistryEntry | undefined {
		return this.tools.get(name);
	}

	/**
	 * Check if a tool exists
	 */
	has(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Get all tool definitions (for Ollama API)
	 */
	getDefinitions(): ToolDefinition[] {
		return Array.from(this.tools.values()).map(entry => entry.definition);
	}

	/**
	 * Get builtin tool definitions only
	 */
	getBuiltinDefinitions(): ToolDefinition[] {
		return getBuiltinToolDefinitions();
	}

	/**
	 * Get all tool names
	 */
	getNames(): string[] {
		return Array.from(this.tools.keys());
	}

	/**
	 * Get count of registered tools
	 */
	get size(): number {
		return this.tools.size;
	}
}

/** Singleton registry instance */
export const toolRegistry = new ToolRegistry();

/**
 * Parse a tool call from model response
 */
export function parseToolCall(call: ToolCall): ParsedToolCall {
	let args: Record<string, unknown> = {};

	try {
		args = JSON.parse(call.function.arguments);
	} catch {
		// If JSON parsing fails, try to extract as simple value
		args = { value: call.function.arguments };
	}

	return {
		id: call.id,
		name: call.function.name,
		arguments: args
	};
}

/**
 * Run a single tool call
 */
export async function runToolCall(
	call: ToolCall | ParsedToolCall,
	context?: ToolContext
): Promise<ToolResult> {
	const parsed = 'function' in call ? parseToolCall(call) : call;
	const { id, name, arguments: args } = parsed;

	const entry = toolRegistry.get(name);
	if (!entry) {
		return {
			toolCallId: id,
			success: false,
			error: `Unknown tool: ${name}`
		};
	}

	try {
		const result = await entry.handler(args);

		// Check if result is an error object
		if (result && typeof result === 'object' && 'error' in result) {
			return {
				toolCallId: id,
				success: false,
				error: String((result as { error: unknown }).error)
			};
		}

		return {
			toolCallId: id,
			success: true,
			result
		};
	} catch (error) {
		return {
			toolCallId: id,
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during tool execution'
		};
	}
}

/**
 * Run multiple tool calls in parallel
 */
export async function runToolCalls(
	calls: (ToolCall | ParsedToolCall)[],
	context?: ToolContext
): Promise<ToolResult[]> {
	return Promise.all(calls.map(call => runToolCall(call, context)));
}

/**
 * Format tool results for inclusion in chat message
 */
export function formatToolResultsForChat(results: ToolResult[]): string {
	return results
		.map(result => {
			if (result.success) {
				const value = typeof result.result === 'object'
					? JSON.stringify(result.result, null, 2)
					: String(result.result);
				return `Tool result: ${value}`;
			} else {
				return `Tool error: ${result.error}`;
			}
		})
		.join('\n\n');
}

/**
 * Create a tool call state for UI tracking
 */
export function createToolCallState(call: ToolCall | ParsedToolCall): ToolCallState {
	const parsed = 'function' in call ? parseToolCall(call) : call;
	return {
		id: parsed.id,
		name: parsed.name,
		arguments: parsed.arguments,
		status: 'pending',
		startTime: Date.now()
	};
}

/**
 * Update tool call state with result
 */
export function updateToolCallState(
	state: ToolCallState,
	result: ToolResult
): ToolCallState {
	return {
		...state,
		status: result.success ? 'success' : 'error',
		result: result.result,
		error: result.error,
		endTime: Date.now()
	};
}
