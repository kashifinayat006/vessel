<script lang="ts">
	/**
	 * VirtualMessageList - Virtualized message list for large conversations
	 * Only renders visible messages for performance with long chats
	 *
	 * Uses @tanstack/svelte-virtual for virtualization.
	 * Falls back to regular rendering if virtualization fails.
	 */

	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import { chatState } from '$lib/stores';
	import type { MessageNode, BranchInfo } from '$lib/types';
	import MessageItem from './MessageItem.svelte';
	import SummarizationIndicator from './SummarizationIndicator.svelte';
	import { onMount } from 'svelte';

	interface Props {
		onRegenerate?: () => void;
		onEditMessage?: (messageId: string, newContent: string) => void;
		showThinking?: boolean;
	}

	const { onRegenerate, onEditMessage, showThinking = true }: Props = $props();

	// Container reference
	let scrollContainer: HTMLDivElement | null = $state(null);

	// Track if component is mounted (scroll container available)
	let isMounted = $state(false);

	// Track user scroll state
	let userScrolledAway = $state(false);
	let autoScrollEnabled = $state(true);
	let wasStreaming = false;

	// Height cache for measured items (message ID -> height)
	const heightCache = new Map<string, number>();

	// Default estimated height for messages
	const DEFAULT_ITEM_HEIGHT = 150;

	// Threshold for scroll detection
	const SCROLL_THRESHOLD = 100;

	// Get visible messages
	const messages = $derived(chatState.visibleMessages);

	// Set mounted after component mounts
	onMount(() => {
		isMounted = true;
	});

	// Create virtualizer - only functional after mount when scrollContainer exists
	const virtualizer = createVirtualizer({
		get count() {
			return messages.length;
		},
		getScrollElement: () => scrollContainer,
		estimateSize: (index: number) => {
			const msg = messages[index];
			if (!msg) return DEFAULT_ITEM_HEIGHT;
			return heightCache.get(msg.id) ?? DEFAULT_ITEM_HEIGHT;
		},
		overscan: 5,
	});

	// Get virtual items with fallback
	const virtualItems = $derived.by(() => {
		if (!isMounted || !scrollContainer) {
			return [];
		}
		return $virtualizer.getVirtualItems();
	});

	// Check if we should use fallback (non-virtual) rendering
	const useFallback = $derived(
		messages.length > 0 && virtualItems.length === 0 && isMounted
	);

	// Track conversation changes to clear cache
	let lastConversationId: string | null = null;
	$effect(() => {
		const currentId = chatState.conversationId;
		if (currentId !== lastConversationId) {
			heightCache.clear();
			lastConversationId = currentId;
		}
	});

	// Force measure after mount and when scroll container becomes available
	$effect(() => {
		if (isMounted && scrollContainer && messages.length > 0) {
			// Use setTimeout to ensure DOM is fully ready
			setTimeout(() => {
				$virtualizer.measure();
			}, 0);
		}
	});

	// Handle streaming scroll behavior
	$effect(() => {
		const isStreaming = chatState.isStreaming;

		if (isStreaming && !wasStreaming) {
			autoScrollEnabled = true;
			if (!userScrolledAway && scrollContainer) {
				requestAnimationFrame(() => {
					if (useFallback) {
						scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
					} else {
						$virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
					}
				});
			}
		}

		wasStreaming = isStreaming;
	});

	// Scroll to bottom during streaming
	$effect(() => {
		const buffer = chatState.streamBuffer;
		const isStreaming = chatState.isStreaming;

		if (isStreaming && buffer && autoScrollEnabled && scrollContainer) {
			requestAnimationFrame(() => {
				if (useFallback) {
					scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
				} else {
					$virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
				}
			});
		}
	});

	// Scroll when new messages are added
	let previousMessageCount = 0;
	$effect(() => {
		const currentCount = messages.length;

		if (currentCount > previousMessageCount && currentCount > 0 && scrollContainer) {
			autoScrollEnabled = true;
			userScrolledAway = false;
			requestAnimationFrame(() => {
				if (useFallback) {
					scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
				} else {
					$virtualizer.scrollToIndex(currentCount - 1, { align: 'end' });
				}
			});
		}

		previousMessageCount = currentCount;
	});

	// Handle scroll events
	function handleScroll(): void {
		if (!scrollContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		userScrolledAway = scrollHeight - scrollTop - clientHeight > SCROLL_THRESHOLD;

		if (userScrolledAway && chatState.isStreaming) {
			autoScrollEnabled = false;
		}
	}

	// Scroll to bottom button handler
	function scrollToBottom(): void {
		if (!scrollContainer) return;

		if (useFallback) {
			scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
		} else if (messages.length > 0) {
			$virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
		}
	}

	// Measure item height after render (for virtualized mode)
	function measureItem(node: HTMLElement, index: number) {
		const msg = messages[index];
		if (!msg) return { destroy: () => {} };

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const height = entry.contentRect.height;
				if (height > 0 && heightCache.get(msg.id) !== height) {
					heightCache.set(msg.id, height);
					$virtualizer.measure();
				}
			}
		});

		resizeObserver.observe(node);

		// Initial measurement
		const height = node.getBoundingClientRect().height;
		if (height > 0) {
			heightCache.set(msg.id, height);
		}

		return {
			destroy() {
				resizeObserver.disconnect();
			}
		};
	}

	// Get branch info for a message
	function getBranchInfo(node: MessageNode): BranchInfo | null {
		const info = chatState.getBranchInfo(node.id);
		if (info && info.totalCount > 1) {
			return info;
		}
		return null;
	}

	// Handle branch switch
	function handleBranchSwitch(messageId: string, direction: 'prev' | 'next'): void {
		chatState.switchBranch(messageId, direction);
	}

	// Check if message is streaming
	function isStreamingMessage(node: MessageNode): boolean {
		return chatState.isStreaming && chatState.streamingMessageId === node.id;
	}

	// Check if message is last
	function isLastMessage(index: number): boolean {
		return index === messages.length - 1;
	}

	// Show scroll button
	const showScrollButton = $derived(userScrolledAway && messages.length > 0);
</script>

<div class="relative h-full">
	<div
		bind:this={scrollContainer}
		onscroll={handleScroll}
		class="h-full overflow-y-auto"
		role="log"
		aria-live="polite"
		aria-label="Chat messages"
	>
		<div class="mx-auto max-w-4xl px-4 py-6">
			{#if useFallback}
				<!-- Fallback: Regular rendering when virtualization isn't working -->
				{#each messages as node, index (node.id)}
					{#if node.message.isSummary}
						<SummarizationIndicator />
					{/if}
					<MessageItem
						{node}
						branchInfo={getBranchInfo(node)}
						isStreaming={isStreamingMessage(node)}
						isLast={isLastMessage(index)}
						{showThinking}
						onBranchSwitch={(direction) => handleBranchSwitch(node.id, direction)}
						onRegenerate={onRegenerate}
						onEdit={(newContent) => onEditMessage?.(node.id, newContent)}
					/>
				{/each}
			{:else}
				<!-- Virtualized rendering -->
				<div
					style="height: {$virtualizer.getTotalSize()}px; width: 100%; position: relative;"
				>
					{#each virtualItems as virtualRow (virtualRow.key)}
						{@const node = messages[virtualRow.index]}
						{@const index = virtualRow.index}
						{#if node}
							<div
								style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({virtualRow.start}px);"
								use:measureItem={index}
							>
								{#if node.message.isSummary}
									<SummarizationIndicator />
								{/if}
								<MessageItem
									{node}
									branchInfo={getBranchInfo(node)}
									isStreaming={isStreamingMessage(node)}
									isLast={isLastMessage(index)}
									{showThinking}
									onBranchSwitch={(direction) => handleBranchSwitch(node.id, direction)}
									onRegenerate={onRegenerate}
									onEdit={(newContent) => onEditMessage?.(node.id, newContent)}
								/>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Scroll to bottom button -->
	{#if showScrollButton}
		<button
			type="button"
			onclick={scrollToBottom}
			class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-theme-tertiary px-4 py-2 text-sm text-theme-secondary shadow-lg transition-all hover:bg-theme-secondary"
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
