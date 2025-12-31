<script lang="ts">
	/**
	 * Summary recommendation banner
	 * Shows when context is getting full and offers summarization
	 */

	import { contextManager, shouldSummarize } from '$lib/memory';
	import { chatState, modelsState } from '$lib/stores';

	// Props
	interface Props {
		onSummarize?: () => void;
		isLoading?: boolean;
	}

	let { onSummarize, isLoading = false }: Props = $props();

	// Check if summarization should be offered
	const showBanner = $derived(
		shouldSummarize(
			contextManager.usedTokens,
			contextManager.maxTokens,
			chatState.visibleMessages.length
		) && !chatState.isStreaming
	);

	// Estimated tokens that could be saved
	const estimatedSavings = $derived.by(() => {
		// Rough estimate: summarizing older messages typically saves 60-80%
		const olderMessages = Math.max(0, chatState.visibleMessages.length - 4);
		const tokensInOlder = Math.floor(contextManager.usedTokens * (olderMessages / chatState.visibleMessages.length));
		return Math.floor(tokensInOlder * 0.7); // Estimate 70% savings
	});
</script>

{#if showBanner}
	<div class="mx-4 mb-2 flex items-center justify-between rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-2">
		<div class="flex items-center gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="text-sm text-amber-200">
				Context getting full. Summarize older messages to free up ~{Math.round(estimatedSavings / 1000)}K tokens.
			</span>
		</div>

		<button
			type="button"
			onclick={onSummarize}
			disabled={isLoading || !modelsState.selectedId}
			class="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if isLoading}
				<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span>Summarizing...</span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<span>Summarize</span>
			{/if}
		</button>
	</div>
{/if}
