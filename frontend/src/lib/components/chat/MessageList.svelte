<script lang="ts">
	/**
	 * MessageList - Scrollable container for chat messages
	 * Auto-scrolls to bottom on new messages, but respects user scroll position
	 */

	import { chatState } from '$lib/stores';
	import type { MessageNode, BranchInfo } from '$lib/types';
	import MessageItem from './MessageItem.svelte';

	interface Props {
		onRegenerate?: () => void;
		onEditMessage?: (messageId: string, newContent: string) => void;
	}

	const { onRegenerate, onEditMessage }: Props = $props();

	// Reference to scroll container
	let scrollContainer: HTMLDivElement | null = $state(null);

	// Track previous message count for auto-scroll
	let previousMessageCount = $state(0);

	// Track if user is near bottom (should auto-scroll)
	let userNearBottom = $state(true);

	// Threshold for "near bottom" detection (pixels from bottom)
	const SCROLL_THRESHOLD = 100;

	/**
	 * Check if scroll position is near the bottom
	 */
	function isNearBottom(): boolean {
		if (!scrollContainer) return true;
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
	}

	/**
	 * Handle scroll events to detect user scroll intent
	 */
	function handleScroll(): void {
		userNearBottom = isNearBottom();
	}

	/**
	 * Scroll to bottom (for button click)
	 */
	function scrollToBottom(): void {
		if (scrollContainer) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
			userNearBottom = true;
		}
	}

	// Auto-scroll to bottom when new messages arrive (only if user was near bottom)
	$effect(() => {
		const currentCount = chatState.visibleMessages.length;

		// Scroll when new message added (if user was near bottom)
		if (scrollContainer && currentCount > previousMessageCount) {
			if (userNearBottom) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}

		previousMessageCount = currentCount;
	});

	// Also scroll on streaming content updates (only if user was near bottom)
	$effect(() => {
		// Access streamBuffer to trigger reactivity
		const _ = chatState.streamBuffer;

		if (scrollContainer && chatState.isStreaming && userNearBottom) {
			// Use requestAnimationFrame for smooth scrolling during streaming
			requestAnimationFrame(() => {
				if (scrollContainer && userNearBottom) {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				}
			});
		}
	});

	// Show scroll-to-bottom button when streaming and user scrolled away
	let showScrollButton = $derived(chatState.isStreaming && !userNearBottom);

	/**
	 * Get branch info for a message
	 */
	function getBranchInfo(node: MessageNode): BranchInfo | null {
		const info = chatState.getBranchInfo(node.id);
		// Only show branch navigator if there are multiple branches
		if (info && info.totalCount > 1) {
			return info;
		}
		return null;
	}

	/**
	 * Handle branch switch
	 */
	function handleBranchSwitch(messageId: string, direction: 'prev' | 'next'): void {
		chatState.switchBranch(messageId, direction);
	}

	/**
	 * Check if a message is currently streaming
	 */
	function isStreamingMessage(node: MessageNode): boolean {
		return chatState.isStreaming && chatState.streamingMessageId === node.id;
	}

	/**
	 * Check if this is the last message
	 */
	function isLastMessage(index: number): boolean {
		return index === chatState.visibleMessages.length - 1;
	}
</script>

<div class="relative h-full">
	<div
		bind:this={scrollContainer}
		onscroll={handleScroll}
		class="h-full overflow-y-auto scroll-smooth"
		role="log"
		aria-live="polite"
		aria-label="Chat messages"
	>
		<div class="mx-auto max-w-4xl px-4 py-6">
			{#each chatState.visibleMessages as node, index (node.id)}
				<MessageItem
					{node}
					branchInfo={getBranchInfo(node)}
					isStreaming={isStreamingMessage(node)}
					isLast={isLastMessage(index)}
					onBranchSwitch={(direction) => handleBranchSwitch(node.id, direction)}
					onRegenerate={onRegenerate}
					onEdit={(newContent) => onEditMessage?.(node.id, newContent)}
				/>
			{/each}
		</div>
	</div>

	<!-- Scroll to bottom button (shown when user scrolls away during streaming) -->
	{#if showScrollButton}
		<button
			type="button"
			onclick={scrollToBottom}
			class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-700 px-4 py-2 text-sm text-slate-200 shadow-lg transition-all hover:bg-slate-600"
			aria-label="Scroll to latest message"
		>
			<span class="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a1 1 0 01-.707-.293l-5-5a1 1 0 011.414-1.414L10 15.586l4.293-4.293a1 1 0 011.414 1.414l-5 5A1 1 0 0110 18z" clip-rule="evenodd" />
				</svg>
				Jump to latest
			</span>
		</button>
	{/if}
</div>
