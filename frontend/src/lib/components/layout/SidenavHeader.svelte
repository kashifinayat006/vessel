<script lang="ts">
	/**
	 * SidenavHeader.svelte - Top section of the sidenav
	 * Contains the app logo/title, "New Chat" button, and import action
	 */
	import { goto } from '$app/navigation';
	import { uiState, chatState, promptsState } from '$lib/stores';
	import { ImportDialog } from '$lib/components/shared';

	// Import dialog state
	let showImportDialog = $state(false);

	/**
	 * Handle new chat - reset state and navigate
	 */
	function handleNewChat(event: MouseEvent) {
		event.preventDefault();
		chatState.reset();
		promptsState.clearTemporaryPrompt();
		goto('/');
	}
</script>

<div class="flex flex-col gap-3 p-3">
	<!-- App title/logo row -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<!-- Vessel logo -->
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 24 24"
				>
					<path d="M12 20 L4 6 Q4 5 5 5 L8 5 L12 12.5 L16 5 L19 5 Q20 5 20 6 L12 20 Z" fill="white"/>
				</svg>
			</div>
			<span class="text-lg font-semibold text-theme-primary">Vessel</span>
		</div>

		<!-- Close sidenav button (visible on mobile) -->
		{#if uiState.isMobile}
			<button
				type="button"
				onclick={() => uiState.closeSidenav()}
				class="rounded-lg p-1.5 text-theme-muted transition-colors hover:bg-theme-secondary hover:text-theme-primary"
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

	<!-- Action buttons row -->
	<div class="flex gap-2">
		<!-- New Chat button -->
		<a
			href="/"
			onclick={handleNewChat}
			class="btn flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-violet-500 active:scale-[0.98]"
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

		<!-- Import button -->
		<button
			type="button"
			onclick={() => (showImportDialog = true)}
			class="rounded-lg border border-theme-subtle p-2.5 text-theme-muted transition-colors hover:border-theme-subtle hover:bg-theme-secondary hover:text-theme-primary"
			aria-label="Import conversation"
			title="Import conversation"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
				/>
			</svg>
		</button>
	</div>
</div>

<!-- Import Dialog -->
<ImportDialog isOpen={showImportDialog} onClose={() => (showImportDialog = false)} />
