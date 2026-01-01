<script lang="ts">
	/**
	 * ConversationList.svelte - Chat history list grouped by date
	 * Uses local conversationsState for immediate updates (offline-first)
	 */
	import { conversationsState, chatState } from '$lib/stores';
	import ConversationItem from './ConversationItem.svelte';

	// State for showing archived conversations
	let showArchived = $state(false);
</script>

<div class="flex flex-col px-2 py-1">
	{#if conversationsState.grouped.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center px-4 py-8 text-center">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="mb-3 h-12 w-12 text-slate-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
				/>
			</svg>
			{#if conversationsState.searchQuery}
				<p class="text-sm text-slate-500">No conversations match your search</p>
				<button
					type="button"
					onclick={() => conversationsState.clearSearch()}
					class="mt-2 text-sm text-emerald-500 hover:text-emerald-400"
				>
					Clear search
				</button>
			{:else}
				<p class="text-sm text-slate-500">No conversations yet</p>
				<p class="mt-1 text-xs text-slate-600">Start a new chat to begin</p>
			{/if}
		</div>
	{:else}
		<!-- Grouped conversations -->
		{#each conversationsState.grouped as { group, conversations } (group)}
			<div class="mb-2">
				<!-- Group header -->
				<h3 class="sticky top-0 z-10 bg-slate-950 px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
					{group}
				</h3>

				<!-- Conversations in this group -->
				<div class="flex flex-col gap-0.5">
					{#each conversations as conversation (conversation.id)}
						<ConversationItem
							{conversation}
							isSelected={chatState.conversationId === conversation.id}
						/>
					{/each}
				</div>
			</div>
		{/each}

		<!-- Archived section -->
		{#if conversationsState.archived.length > 0}
			<div class="mt-4 border-t border-slate-700/50 pt-2">
				<button
					type="button"
					onclick={() => (showArchived = !showArchived)}
					class="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-400"
				>
					<span>Archived ({conversationsState.archived.length})</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 transition-transform"
						class:rotate-180={showArchived}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
					</svg>
				</button>

				{#if showArchived}
					<div class="mt-1 flex flex-col gap-0.5">
						{#each conversationsState.archived as conversation (conversation.id)}
							<ConversationItem
								{conversation}
								isSelected={chatState.conversationId === conversation.id}
							/>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
