<script lang="ts">
	/**
	 * SidenavHeader.svelte - Top section of the sidenav
	 * Contains the app logo/title and "New Chat" button
	 */
	import { goto } from '$app/navigation';
	import { uiState, chatState } from '$lib/stores';

	/**
	 * Handle new chat - reset state and navigate
	 */
	function handleNewChat(event: MouseEvent) {
		event.preventDefault();
		chatState.reset();
		goto('/');
	}
</script>

<div class="flex flex-col gap-3 p-3">
	<!-- App title/logo row -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<!-- Ollama logo placeholder -->
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-white"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
				</svg>
			</div>
			<span class="text-lg font-semibold text-slate-100">Ollama Chat</span>
		</div>

		<!-- Close sidenav button (visible on mobile) -->
		{#if uiState.isMobile}
			<button
				type="button"
				onclick={() => uiState.closeSidenav()}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
				aria-label="Close sidebar"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- New Chat button -->
	<a
		href="/"
		onclick={handleNewChat}
		class="btn flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 active:scale-[0.98]"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-5 w-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
		</svg>
		<span>New Chat</span>
	</a>
</div>
