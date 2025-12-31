<script lang="ts">
	/**
	 * EmptyState - Displayed when there are no messages
	 * Shows a welcome message and suggestions
	 */

	import { modelsState } from '$lib/stores';

	const selectedModel = $derived(modelsState.selected);
	const hasModel = $derived(!!modelsState.selectedId);
</script>

<div class="flex flex-col items-center justify-center px-4 py-12 text-center">
	<!-- Logo/Icon -->
	<div
		class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			class="h-8 w-8"
		>
			<path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
		</svg>
	</div>

	<!-- Welcome text -->
	<h2 class="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
		{#if hasModel}
			Start a conversation
		{:else}
			No model selected
		{/if}
	</h2>

	<p class="mb-8 max-w-md text-gray-600 dark:text-gray-400">
		{#if hasModel && selectedModel}
			You're chatting with <span class="font-medium text-gray-900 dark:text-white">{selectedModel.name}</span>.
			Type a message below to begin.
		{:else}
			Please select a model from the sidebar to start chatting.
		{/if}
	</p>

	<!-- Suggestion cards -->
	{#if hasModel}
		<div class="grid max-w-2xl gap-3 sm:grid-cols-2">
			{@render SuggestionCard({
				icon: "lightbulb",
				title: "Ask a question",
				description: "Get explanations on any topic"
			})}
			{@render SuggestionCard({
				icon: "code",
				title: "Write code",
				description: "Generate or debug code snippets"
			})}
			{@render SuggestionCard({
				icon: "pencil",
				title: "Create content",
				description: "Draft emails, articles, or stories"
			})}
			{@render SuggestionCard({
				icon: "chat",
				title: "Have a conversation",
				description: "Discuss ideas and get feedback"
			})}
		</div>
	{/if}
</div>

{#snippet SuggestionCard(props: { icon: string; title: string; description: string })}
	<div
		class="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-750"
	>
		<div class="flex-shrink-0 text-gray-400 dark:text-gray-500">
			{#if props.icon === 'lightbulb'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
					<path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
				</svg>
			{:else if props.icon === 'code'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
					<path fill-rule="evenodd" d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06zM11.377 2.011a.75.75 0 01.612.867l-2.5 14.5a.75.75 0 01-1.478-.255l2.5-14.5a.75.75 0 01.866-.612z" clip-rule="evenodd" />
				</svg>
			{:else if props.icon === 'pencil'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
					<path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
				</svg>
			{:else if props.icon === 'chat'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
					<path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293c.121-.233.362-.393.642-.413a41.102 41.102 0 003.55-.414c1.437-.232 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zM6.75 6a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 2.5a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clip-rule="evenodd" />
				</svg>
			{/if}
		</div>
		<div>
			<h3 class="font-medium text-gray-900 dark:text-white">{props.title}</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400">{props.description}</p>
		</div>
	</div>
{/snippet}
