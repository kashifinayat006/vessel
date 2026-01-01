/**
 * Context window management with reactive state
 *
 * Tracks token usage across the conversation and provides
 * warnings when approaching context limits.
 */

import type { MessageNode } from '$lib/types/chat.js';
import type { ContextUsage, TokenEstimate, MessageWithTokens } from './types.js';
import { estimateMessageTokens, estimateFormatOverhead, formatTokenCount } from './tokenizer.js';
import { getModelContextLimit, formatContextSize } from './model-limits.js';

/** Warning threshold as percentage of context (0.85 = 85%) */
const WARNING_THRESHOLD = 0.85;

/** Critical threshold (context almost full) */
const CRITICAL_THRESHOLD = 0.95;

/** Throttle interval for updates during streaming (ms) */
const STREAMING_THROTTLE_MS = 500;

/** Context manager with reactive state */
class ContextManager {
	/** Current model name */
	currentModel = $state<string>('');

	/** Maximum context length for current model */
	maxTokens = $state<number>(4096);

	/**
	 * Cached token estimates for messages (id -> estimate)
	 * Non-reactive to avoid cascading updates during streaming
	 */
	private tokenCache: Map<string, TokenEstimate> = new Map();

	/** Current conversation messages with token counts */
	messagesWithTokens = $state<MessageWithTokens[]>([]);

	/** Last update timestamp for throttling */
	private lastUpdateTime = 0;

	/** Pending update for throttled calls */
	private pendingUpdate: MessageNode[] | null = null;

	/** Timeout handle for pending updates */
	private updateTimeout: ReturnType<typeof setTimeout> | null = null;

	/** Total estimated tokens used */
	usedTokens = $derived.by(() => {
		let total = 0;
		for (const msg of this.messagesWithTokens) {
			total += msg.estimatedTokens.totalTokens;
		}
		// Add format overhead
		total += estimateFormatOverhead(this.messagesWithTokens.length);
		return total;
	});

	/** Context usage info */
	contextUsage = $derived.by((): ContextUsage => {
		const used = this.usedTokens;
		const max = this.maxTokens;
		return {
			usedTokens: used,
			maxTokens: max,
			percentage: max > 0 ? (used / max) * 100 : 0,
			remainingTokens: Math.max(0, max - used)
		};
	});

	/** Whether we're approaching the context limit */
	isNearLimit = $derived(this.contextUsage.percentage >= WARNING_THRESHOLD * 100);

	/** Whether context is critically full */
	isCritical = $derived(this.contextUsage.percentage >= CRITICAL_THRESHOLD * 100);

	/** Human-readable status message */
	statusMessage = $derived.by(() => {
		const { percentage, usedTokens, maxTokens } = this.contextUsage;
		const used = formatTokenCount(usedTokens);
		const max = formatContextSize(maxTokens);

		if (this.isCritical) {
			return `Context almost full: ${used} / ${max} (${percentage.toFixed(0)}%)`;
		}
		if (this.isNearLimit) {
			return `Approaching context limit: ${used} / ${max} (${percentage.toFixed(0)}%)`;
		}
		return `${used} / ${max} tokens (${percentage.toFixed(0)}%)`;
	});

	/**
	 * Set the current model and update context limit
	 */
	setModel(modelName: string): void {
		this.currentModel = modelName;
		this.maxTokens = getModelContextLimit(modelName);
	}

	/**
	 * Update messages and recalculate token estimates
	 * Throttles updates during streaming to prevent performance issues
	 */
	updateMessages(messages: MessageNode[], force = false): void {
		const now = Date.now();
		const timeSinceLastUpdate = now - this.lastUpdateTime;

		// If we're within the throttle window and not forcing, schedule for later
		if (!force && timeSinceLastUpdate < STREAMING_THROTTLE_MS) {
			this.pendingUpdate = messages;

			// Schedule update if not already scheduled
			if (!this.updateTimeout) {
				this.updateTimeout = setTimeout(() => {
					this.updateTimeout = null;
					if (this.pendingUpdate) {
						this.updateMessages(this.pendingUpdate, true);
						this.pendingUpdate = null;
					}
				}, STREAMING_THROTTLE_MS - timeSinceLastUpdate);
			}
			return;
		}

		this.lastUpdateTime = now;
		this.performUpdate(messages);
	}

	/**
	 * Actually perform the message update (internal)
	 */
	private performUpdate(messages: MessageNode[]): void {
		const newMessagesWithTokens: MessageWithTokens[] = [];

		for (const node of messages) {
			// Check cache first
			let estimate = this.tokenCache.get(node.id);

			if (!estimate) {
				// Calculate and cache (non-reactive mutation)
				estimate = estimateMessageTokens(
					node.message.content,
					node.message.images
				);
				this.tokenCache.set(node.id, estimate);
			}

			newMessagesWithTokens.push({
				id: node.id,
				role: node.message.role,
				content: node.message.content,
				images: node.message.images,
				estimatedTokens: estimate
			});
		}

		this.messagesWithTokens = newMessagesWithTokens;
	}

	/**
	 * Invalidate cache for a specific message (e.g., after streaming update)
	 * Non-reactive to avoid cascading updates during streaming
	 */
	invalidateMessage(messageId: string): void {
		// Non-reactive deletion - just mutate the cache directly
		this.tokenCache.delete(messageId);
	}

	/**
	 * Flush any pending updates immediately
	 * Call this when streaming ends to ensure final state is accurate
	 */
	flushPendingUpdate(): void {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}
		if (this.pendingUpdate) {
			this.performUpdate(this.pendingUpdate);
			this.pendingUpdate = null;
		}
	}

	/**
	 * Get token estimate for a specific message
	 */
	getMessageTokens(messageId: string): TokenEstimate | null {
		return this.tokenCache.get(messageId) ?? null;
	}

	/**
	 * Estimate tokens for new content (before sending)
	 */
	estimateNewMessage(content: string, images?: string[]): TokenEstimate {
		return estimateMessageTokens(content, images);
	}

	/**
	 * Check if adding a message would exceed context
	 */
	wouldExceedContext(newTokens: number): boolean {
		return (this.usedTokens + newTokens) > this.maxTokens;
	}

	/**
	 * Get the number of messages that could be trimmed to free space
	 * Returns indices of messages to remove (oldest first, excluding system)
	 */
	getMessagesToTrim(targetFreeTokens: number): number[] {
		const indicesToRemove: number[] = [];
		let freedTokens = 0;

		// Start from oldest messages (index 0), skip system messages
		for (let i = 0; i < this.messagesWithTokens.length && freedTokens < targetFreeTokens; i++) {
			const msg = this.messagesWithTokens[i];
			if (msg.role === 'system') continue;

			indicesToRemove.push(i);
			freedTokens += msg.estimatedTokens.totalTokens;
		}

		return indicesToRemove;
	}

	/**
	 * Clear the cache and messages
	 */
	reset(): void {
		// Clear pending updates
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}
		this.pendingUpdate = null;
		this.lastUpdateTime = 0;

		// Clear cache and messages
		this.tokenCache.clear();
		this.messagesWithTokens = [];
	}
}

/** Singleton context manager instance */
export const contextManager = new ContextManager();

/**
 * Get color class for context usage percentage
 */
export function getContextUsageColor(percentage: number): string {
	if (percentage >= CRITICAL_THRESHOLD * 100) {
		return 'text-red-500';
	}
	if (percentage >= WARNING_THRESHOLD * 100) {
		return 'text-yellow-500';
	}
	return 'text-theme-muted';
}

/**
 * Get progress bar color class
 */
export function getProgressBarColor(percentage: number): string {
	if (percentage >= CRITICAL_THRESHOLD * 100) {
		return 'bg-red-500';
	}
	if (percentage >= WARNING_THRESHOLD * 100) {
		return 'bg-yellow-500';
	}
	return 'bg-blue-500';
}
