<script lang="ts">
	/**
	 * ChatInput - Message input area with auto-growing textarea
	 * Handles send/stop actions, keyboard shortcuts, and image uploads
	 */

	import { modelsState } from '$lib/stores';
	import ImageUpload from './ImageUpload.svelte';

	interface Props {
		onSend?: (content: string, images?: string[]) => void;
		onStop?: () => void;
		isStreaming?: boolean;
		disabled?: boolean;
		placeholder?: string;
	}

	const {
		onSend,
		onStop,
		isStreaming = false,
		disabled = false,
		placeholder = 'Type a message...'
	}: Props = $props();

	// Input state
	let inputValue = $state('');
	let textareaElement: HTMLTextAreaElement | null = $state(null);

	// Image state
	let pendingImages = $state<string[]>([]);

	// Derived state
	const hasContent = $derived(inputValue.trim().length > 0 || pendingImages.length > 0);
	const canSend = $derived(hasContent && !disabled && !isStreaming);
	const showStopButton = $derived(isStreaming);

	// Vision model detection
	const isVisionModel = $derived(modelsState.selectedSupportsVision);

	/**
	 * Auto-resize textarea based on content
	 */
	function autoResize(): void {
		if (!textareaElement) return;

		// Reset height to auto to get the correct scrollHeight
		textareaElement.style.height = 'auto';

		// Calculate new height (max 200px)
		const newHeight = Math.min(textareaElement.scrollHeight, 200);
		textareaElement.style.height = `${newHeight}px`;
	}

	/**
	 * Handle input changes
	 */
	function handleInput(): void {
		autoResize();
	}

	/**
	 * Handle keyboard events
	 */
	function handleKeydown(event: KeyboardEvent): void {
		// Enter to send (without Shift)
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	}

	/**
	 * Send the message
	 */
	function handleSend(): void {
		if (!canSend) return;

		const content = inputValue.trim();
		const images = pendingImages.length > 0 ? [...pendingImages] : undefined;

		// Clear input and images
		inputValue = '';
		pendingImages = [];

		// Reset textarea height
		if (textareaElement) {
			textareaElement.style.height = 'auto';
		}

		onSend?.(content, images);
	}

	/**
	 * Stop streaming
	 */
	function handleStop(): void {
		onStop?.();
	}

	/**
	 * Handle image changes from ImageUpload
	 */
	function handleImagesChange(images: string[]): void {
		pendingImages = images;
	}

	// Focus textarea on mount
	$effect(() => {
		if (textareaElement && !disabled) {
			textareaElement.focus();
		}
	});
</script>

<div class="relative space-y-3">
	<!-- Image upload area (only shown for vision models) -->
	{#if isVisionModel}
		<ImageUpload
			images={pendingImages}
			onImagesChange={handleImagesChange}
			disabled={disabled || isStreaming}
		/>
	{/if}

	<div
		class="flex items-end gap-2 rounded-2xl border border-gray-300 bg-white p-2 shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
	>
		<!-- Image indicator button (for vision models) -->
		{#if isVisionModel && pendingImages.length > 0}
			<div class="flex h-10 items-center justify-center px-2">
				<span class="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-3.5 w-3.5"
					>
						<path
							fill-rule="evenodd"
							d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909.47.47a.75.75 0 1 1-1.06 1.06L6.53 8.091a.75.75 0 0 0-1.06 0l-2.97 2.97ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
							clip-rule="evenodd"
						/>
					</svg>
					{pendingImages.length}
				</span>
			</div>
		{/if}

		<!-- Textarea -->
		<textarea
			bind:this={textareaElement}
			bind:value={inputValue}
			oninput={handleInput}
			onkeydown={handleKeydown}
			{placeholder}
			disabled={disabled || isStreaming}
			rows="1"
			class="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-gray-900 placeholder-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:placeholder-gray-400"
			aria-label="Message input"
		></textarea>

		<!-- Action buttons -->
		<div class="flex items-center gap-1">
			{#if showStopButton}
				<!-- Stop button -->
				<button
					type="button"
					onclick={handleStop}
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
					aria-label="Stop generating"
					title="Stop generating"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-5 w-5"
					>
						<rect x="5" y="5" width="10" height="10" rx="1" />
					</svg>
				</button>
			{:else}
				<!-- Send button -->
				<button
					type="button"
					onclick={handleSend}
					disabled={!canSend}
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600"
					aria-label="Send message"
					title="Send message"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-5 w-5"
					>
						<path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Helper text -->
	<p class="mt-1.5 text-center text-xs text-gray-500 dark:text-gray-400">
		Press <kbd class="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs dark:bg-gray-700">Enter</kbd> to send,
		<kbd class="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs dark:bg-gray-700">Shift+Enter</kbd> for new line
		{#if isVisionModel}
			<span class="ml-1">| Vision model: paste or drag images</span>
		{/if}
	</p>
</div>
