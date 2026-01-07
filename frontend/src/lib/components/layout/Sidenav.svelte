<script lang="ts">
	/**
	 * Sidenav.svelte - Collapsible sidebar for the Ollama chat UI
	 * Contains navigation header, search, projects, and conversation list
	 */
	import { page } from '$app/stores';
	import { uiState } from '$lib/stores';
	import SidenavHeader from './SidenavHeader.svelte';
	import SidenavSearch from './SidenavSearch.svelte';
	import ConversationList from './ConversationList.svelte';
	import ProjectModal from '$lib/components/projects/ProjectModal.svelte';

	// Project modal state
	let showProjectModal = $state(false);
	let editingProjectId = $state<string | null>(null);

	function handleCreateProject() {
		editingProjectId = null;
		showProjectModal = true;
	}

	function handleEditProject(projectId: string) {
		editingProjectId = projectId;
		showProjectModal = true;
	}

	function handleCloseProjectModal() {
		showProjectModal = false;
		editingProjectId = null;
	}
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
	class="fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden bg-theme-sidenav transition-all duration-300 ease-in-out"
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

		<!-- Create Project button -->
		<div class="px-3 pb-2">
			<button
				type="button"
				onclick={handleCreateProject}
				class="flex w-full items-center gap-2 rounded-lg border border-dashed border-theme px-3 py-2 text-sm text-theme-muted transition-colors hover:border-emerald-500/50 hover:bg-theme-secondary/50 hover:text-emerald-500"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 4.5v15m7.5-7.5h-15"
					/>
				</svg>
				<span>New Project</span>
			</button>
		</div>

		<!-- Conversation list (scrollable) -->
		<div class="flex-1 overflow-y-auto overflow-x-hidden">
			<ConversationList onEditProject={handleEditProject} />
		</div>

		<!-- Footer / Settings link -->
		<div class="border-t border-theme p-3">
			<a
				href="/settings"
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {$page.url.pathname.startsWith('/settings') ? 'bg-violet-500/20 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-theme-muted hover:bg-theme-hover hover:text-theme-primary'}"
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
			</a>
		</div>
	</div>
</aside>

<!-- Project Modal -->
<ProjectModal
	isOpen={showProjectModal}
	onClose={handleCloseProjectModal}
	projectId={editingProjectId}
/>
