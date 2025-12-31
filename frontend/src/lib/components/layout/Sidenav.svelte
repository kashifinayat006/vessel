<script lang="ts">
	/**
	 * Sidenav.svelte - Collapsible sidebar for the Ollama chat UI
	 * Contains navigation header, search, and conversation list
	 */
	import { page } from '$app/stores';
	import { uiState } from '$lib/stores';
	import SidenavHeader from './SidenavHeader.svelte';
	import SidenavSearch from './SidenavSearch.svelte';
	import ConversationList from './ConversationList.svelte';
	import { SettingsModal } from '$lib/components/shared';

	// Check if a path is active
	const isActive = (path: string) => $page.url.pathname === path;

	// Settings modal state
	let settingsOpen = $state(false);
</script>

<!-- Overlay for mobile (closes sidenav when clicking outside) -->
{#if uiState.isMobile && uiState.sidenavOpen}
	<button
		class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
		onclick={() => uiState.closeSidenav()}
		aria-label="Close sidebar"
		type="button"
	></button>
{/if}

<!-- Sidenav container -->
<aside
	class="fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden bg-slate-950 transition-all duration-300 ease-in-out"
	class:w-[280px]={uiState.sidenavOpen}
	class:w-0={!uiState.sidenavOpen}
	class:shadow-xl={uiState.sidenavOpen}
	aria-label="Sidebar navigation"
>
	<div class="flex h-full w-[280px] flex-col">
		<!-- Header with new chat button -->
		<SidenavHeader />

		<!-- Search bar -->
		<SidenavSearch />

		<!-- Conversation list (scrollable) -->
		<div class="flex-1 overflow-y-auto overflow-x-hidden">
			<ConversationList />
		</div>

		<!-- Footer / Navigation links -->
		<div class="border-t border-slate-700/50 p-3 space-y-1">
			<!-- Knowledge Base link -->
			<a
				href="/knowledge"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive('/knowledge') ? 'bg-blue-900/30 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
					/>
				</svg>
				<span>Knowledge Base</span>
			</a>

			<!-- Tools link -->
			<a
				href="/tools"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive('/tools') ? 'bg-emerald-900/30 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
					/>
				</svg>
				<span>Tools</span>
			</a>

			<!-- Prompts link -->
			<a
				href="/prompts"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive('/prompts') ? 'bg-purple-900/30 text-purple-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
					/>
				</svg>
				<span>Prompts</span>
			</a>

			<!-- Settings button -->
			<button
				type="button"
				onclick={() => (settingsOpen = true)}
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
					/>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</svg>
				<span>Settings</span>
			</button>
		</div>
	</div>
</aside>

<!-- Settings Modal -->
<SettingsModal isOpen={settingsOpen} onClose={() => (settingsOpen = false)} />
