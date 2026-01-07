<script lang="ts">
	/**
	 * ProjectFolder.svelte - Collapsible folder for project conversations
	 * Shows project name, color indicator, and nested conversations
	 */
	import type { Project } from '$lib/stores/projects.svelte.js';
	import type { Conversation } from '$lib/types/conversation.js';
	import { projectsState, chatState } from '$lib/stores';
	import ConversationItem from './ConversationItem.svelte';
	import { goto } from '$app/navigation';

	interface Props {
		project: Project;
		conversations: Conversation[];
		onEditProject?: (projectId: string) => void;
	}

	let { project, conversations, onEditProject }: Props = $props();

	// Track if this project is expanded
	const isExpanded = $derived(!projectsState.collapsedIds.has(project.id));

	/** Toggle folder collapse state */
	async function handleToggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		await projectsState.toggleCollapse(project.id);
	}

	/** Navigate to project page */
	function handleOpenProject(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		goto(`/projects/${project.id}`);
	}

	/** Handle project settings click */
	function handleSettings(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		onEditProject?.(project.id);
	}
</script>

<div class="mb-1">
	<!-- Project header -->
	<div class="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-theme-secondary/60">
		<!-- Collapse indicator (clickable) -->
		<button
			type="button"
			onclick={handleToggle}
			class="shrink-0 rounded p-0.5 text-theme-muted transition-colors hover:text-theme-primary"
			aria-label={isExpanded ? 'Collapse project' : 'Expand project'}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-3 w-3 transition-transform {isExpanded ? 'rotate-90' : ''}"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>

		<!-- Project link (folder icon + name) - navigates to project page -->
		<a
			href="/projects/{project.id}"
			onclick={handleOpenProject}
			class="flex flex-1 items-center gap-2 truncate"
			title="Open project"
		>
			<!-- Folder icon with project color -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4 shrink-0"
				viewBox="0 0 20 20"
				fill={project.color || '#10b981'}
			>
				<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
			</svg>

			<!-- Project name -->
			<span class="flex-1 truncate text-sm font-medium text-theme-secondary hover:text-theme-primary">
				{project.name}
			</span>
		</a>

		<!-- Conversation count -->
		<span class="shrink-0 text-xs text-theme-muted">
			{conversations.length}
		</span>

		<!-- Settings button (hidden until hover) -->
		<button
			type="button"
			onclick={handleSettings}
			class="shrink-0 rounded p-0.5 text-theme-muted opacity-0 transition-opacity hover:bg-theme-tertiary hover:text-theme-primary group-hover:opacity-100"
			aria-label="Project settings"
			title="Settings"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-3.5 w-3.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
				/>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		</button>
	</div>

	<!-- Conversations in this project -->
	{#if isExpanded && conversations.length > 0}
		<div class="ml-3 flex flex-col gap-0.5 border-l border-theme/30 pl-2">
			{#each conversations as conversation (conversation.id)}
				<ConversationItem
					{conversation}
					isSelected={chatState.conversationId === conversation.id}
				/>
			{/each}
		</div>
	{/if}

	<!-- Empty state for expanded folder with no conversations -->
	{#if isExpanded && conversations.length === 0}
		<div class="ml-3 border-l border-theme/30 pl-2">
			<p class="px-3 py-2 text-xs text-theme-muted italic">
				No conversations yet
			</p>
		</div>
	{/if}
</div>
