/**
 * Prompt Resolution Service
 *
 * Determines which system prompt to use for a chat based on priority:
 * 1. Per-conversation prompt (explicit user override)
 * 2. New chat prompt selection (before conversation exists)
 * 3. Model-prompt mapping (user configured default for model)
 * 4. Model-embedded prompt (from Ollama Modelfile SYSTEM directive)
 * 5. Capability-matched prompt (user prompt targeting model capabilities)
 * 6. Global active prompt
 * 7. No prompt
 */

import { promptsState, type Prompt } from '$lib/stores/prompts.svelte.js';
import { modelPromptMappingsState } from '$lib/stores/model-prompt-mappings.svelte.js';
import { modelInfoService } from '$lib/services/model-info-service.js';
import type { OllamaCapability } from '$lib/ollama/types.js';

/** Source of the resolved prompt */
export type PromptSource =
	| 'per-conversation'
	| 'new-chat-selection'
	| 'model-mapping'
	| 'model-embedded'
	| 'capability-match'
	| 'global-active'
	| 'none';

/** Result of prompt resolution */
export interface ResolvedPrompt {
	/** The system prompt content to use */
	content: string;
	/** Where this prompt came from */
	source: PromptSource;
	/** Name of the prompt (for display) */
	promptName?: string;
	/** Matched capability (if source is capability-match) */
	matchedCapability?: OllamaCapability;
}

/** Priority order for capability matching */
const CAPABILITY_PRIORITY: OllamaCapability[] = ['code', 'vision', 'thinking', 'tools'];

/**
 * Find a user prompt that targets specific capabilities.
 *
 * @param capabilities - Model capabilities to match against
 * @param prompts - Available user prompts
 * @returns Matched prompt and capability, or null
 */
function findCapabilityMatchedPrompt(
	capabilities: OllamaCapability[],
	prompts: Prompt[]
): { prompt: Prompt; capability: OllamaCapability } | null {
	for (const capability of CAPABILITY_PRIORITY) {
		if (!capabilities.includes(capability)) continue;

		// Find a prompt targeting this capability
		const match = prompts.find(
			(p) => (p as Prompt & { targetCapabilities?: string[] }).targetCapabilities?.includes(capability)
		);
		if (match) {
			return { prompt: match, capability };
		}
	}
	return null;
}

/**
 * Resolve which system prompt to use for a chat.
 *
 * Priority order:
 * 1. Per-conversation prompt (explicit user override)
 * 2. New chat prompt selection (before conversation exists)
 * 3. Model-prompt mapping (user configured default for model)
 * 4. Model-embedded prompt (from Ollama Modelfile)
 * 5. Capability-matched prompt
 * 6. Global active prompt
 * 7. No prompt
 *
 * @param modelName - Ollama model name (e.g., "llama3.2:8b")
 * @param conversationPromptId - Per-conversation prompt ID (if set)
 * @param newChatPromptId - New chat selection (before conversation created)
 * @returns Resolved prompt with content and source
 */
export async function resolveSystemPrompt(
	modelName: string,
	conversationPromptId?: string | null,
	newChatPromptId?: string | null
): Promise<ResolvedPrompt> {
	// Ensure stores are loaded
	await promptsState.ready();
	await modelPromptMappingsState.ready();

	// 1. Per-conversation prompt (highest priority)
	if (conversationPromptId) {
		const prompt = promptsState.get(conversationPromptId);
		if (prompt) {
			return {
				content: prompt.content,
				source: 'per-conversation',
				promptName: prompt.name
			};
		}
	}

	// 2. New chat prompt selection (before conversation exists)
	if (newChatPromptId) {
		const prompt = promptsState.get(newChatPromptId);
		if (prompt) {
			return {
				content: prompt.content,
				source: 'new-chat-selection',
				promptName: prompt.name
			};
		}
	}

	// 3. User-configured model-prompt mapping
	const mappedPromptId = modelPromptMappingsState.getMapping(modelName);
	if (mappedPromptId) {
		const prompt = promptsState.get(mappedPromptId);
		if (prompt) {
			return {
				content: prompt.content,
				source: 'model-mapping',
				promptName: prompt.name
			};
		}
	}

	// 4. Model-embedded prompt (from Ollama Modelfile SYSTEM directive)
	const modelInfo = await modelInfoService.getModelInfo(modelName);
	if (modelInfo.systemPrompt) {
		return {
			content: modelInfo.systemPrompt,
			source: 'model-embedded',
			promptName: `${modelName} (embedded)`
		};
	}

	// 5. Capability-matched prompt
	if (modelInfo.capabilities.length > 0) {
		const capabilityMatch = findCapabilityMatchedPrompt(modelInfo.capabilities, promptsState.prompts);
		if (capabilityMatch) {
			return {
				content: capabilityMatch.prompt.content,
				source: 'capability-match',
				promptName: capabilityMatch.prompt.name,
				matchedCapability: capabilityMatch.capability
			};
		}
	}

	// 6. Global active prompt
	const activePrompt = promptsState.activePrompt;
	if (activePrompt) {
		return {
			content: activePrompt.content,
			source: 'global-active',
			promptName: activePrompt.name
		};
	}

	// 7. No prompt
	return {
		content: '',
		source: 'none'
	};
}

/**
 * Get a human-readable description of a prompt source.
 *
 * @param source - Prompt source type
 * @returns Display string for the source
 */
export function getPromptSourceLabel(source: PromptSource): string {
	switch (source) {
		case 'per-conversation':
			return 'Custom (this chat)';
		case 'new-chat-selection':
			return 'Selected prompt';
		case 'model-mapping':
			return 'Model default';
		case 'model-embedded':
			return 'Model built-in';
		case 'capability-match':
			return 'Auto-matched';
		case 'global-active':
			return 'Global default';
		case 'none':
			return 'None';
	}
}
