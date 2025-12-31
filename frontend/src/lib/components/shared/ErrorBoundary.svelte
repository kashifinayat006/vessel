<script lang="ts">
	/**
	 * ErrorBoundary - Catches and displays errors gracefully
	 * Prevents entire app from crashing when a component fails
	 */

	import type { Snippet } from 'svelte';

	interface Props {
		/** Content to render */
		children: Snippet;
		/** Optional fallback content when error occurs */
		fallback?: Snippet<[Error]>;
		/** Callback when an error is caught */
		onError?: (error: Error) => void;
	}

	const { children, fallback, onError }: Props = $props();

	// Error state
	let error = $state<Error | null>(null);
	let hasError = $derived(error !== null);

	/**
	 * Reset the error state to try rendering again
	 */
	function reset(): void {
		error = null;
	}
</script>

<svelte:boundary
	onerror={(err) => {
		error = err instanceof Error ? err : new Error(String(err));
		onError?.(error);
	}}
>
	{#if hasError && error}
		{#if fallback}
			{@render fallback(error)}
		{:else}
			<!-- Default error UI -->
			<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
				<div class="flex items-start gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 flex-shrink-0 text-red-400"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					<div class="flex-1">
						<h3 class="font-medium text-red-400">Something went wrong</h3>
						<p class="mt-1 text-sm text-red-300/80">{error.message}</p>
						<button
							type="button"
							onclick={reset}
							class="mt-3 rounded-md bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
						>
							Try again
						</button>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		{@render children()}
	{/if}
</svelte:boundary>
