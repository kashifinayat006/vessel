<script lang="ts">
	/**
	 * System prompts management page
	 * Create, edit, and manage system prompt templates
	 */

	import { promptsState, type Prompt } from '$lib/stores';

	// Editor state
	let showEditor = $state(false);
	let editingPrompt = $state<Prompt | null>(null);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formContent = $state('');
	let formIsDefault = $state(false);
	let isSaving = $state(false);

	function openCreateEditor(): void {
		editingPrompt = null;
		formName = '';
		formDescription = '';
		formContent = '';
		formIsDefault = false;
		showEditor = true;
	}

	function openEditEditor(prompt: Prompt): void {
		editingPrompt = prompt;
		formName = prompt.name;
		formDescription = prompt.description;
		formContent = prompt.content;
		formIsDefault = prompt.isDefault;
		showEditor = true;
	}

	function closeEditor(): void {
		showEditor = false;
		editingPrompt = null;
	}

	async function handleSave(): Promise<void> {
		if (!formName.trim() || !formContent.trim()) return;

		isSaving = true;
		try {
			if (editingPrompt) {
				await promptsState.update(editingPrompt.id, {
					name: formName.trim(),
					description: formDescription.trim(),
					content: formContent,
					isDefault: formIsDefault
				});
			} else {
				await promptsState.add({
					name: formName.trim(),
					description: formDescription.trim(),
					content: formContent,
					isDefault: formIsDefault
				});
			}
			closeEditor();
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete(prompt: Prompt): Promise<void> {
		if (confirm(`Delete "${prompt.name}"? This cannot be undone.`)) {
			await promptsState.remove(prompt.id);
		}
	}

	async function handleSetDefault(prompt: Prompt): Promise<void> {
		if (prompt.isDefault) {
			await promptsState.clearDefault();
		} else {
			await promptsState.setDefault(prompt.id);
		}
	}

	function handleSetActive(prompt: Prompt): void {
		if (promptsState.activePromptId === prompt.id) {
			promptsState.setActive(null);
		} else {
			promptsState.setActive(prompt.id);
		}
	}

	// Format date for display
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="h-full overflow-y-auto bg-slate-900 p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-white">System Prompts</h1>
				<p class="mt-1 text-sm text-slate-400">
					Create and manage system prompt templates for conversations
				</p>
			</div>

			<button
				type="button"
				onclick={openCreateEditor}
				class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Create Prompt
			</button>
		</div>

		<!-- Active prompt indicator -->
		{#if promptsState.activePrompt}
			<div class="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
				<div class="flex items-center gap-2 text-sm text-blue-400">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>Active system prompt for new chats: <strong class="text-blue-300">{promptsState.activePrompt.name}</strong></span>
				</div>
			</div>
		{/if}

		<!-- Prompts list -->
		{#if promptsState.isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
			</div>
		{:else if promptsState.prompts.length === 0}
			<div class="rounded-lg border border-dashed border-slate-700 bg-slate-800/50 p-8 text-center">
				<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
				</svg>
				<h3 class="mt-4 text-sm font-medium text-slate-400">No system prompts yet</h3>
				<p class="mt-1 text-sm text-slate-500">
					Create a system prompt to customize AI behavior
				</p>
				<button
					type="button"
					onclick={openCreateEditor}
					class="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Create your first prompt
				</button>
			</div>
		{:else}
			<div class="space-y-3">
				{#each promptsState.prompts as prompt (prompt.id)}
					<div
						class="rounded-lg border bg-slate-800 p-4 transition-colors {promptsState.activePromptId === prompt.id ? 'border-blue-500/50' : 'border-slate-700'}"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<h3 class="font-medium text-white">{prompt.name}</h3>
									{#if prompt.isDefault}
										<span class="rounded bg-blue-900 px-2 py-0.5 text-xs text-blue-300">
											default
										</span>
									{/if}
									{#if promptsState.activePromptId === prompt.id}
										<span class="rounded bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">
											active
										</span>
									{/if}
								</div>
								{#if prompt.description}
									<p class="mt-1 text-sm text-slate-400">{prompt.description}</p>
								{/if}
								<p class="mt-2 line-clamp-2 text-sm text-slate-500">
									{prompt.content}
								</p>
								<p class="mt-2 text-xs text-slate-600">
									Updated {formatDate(prompt.updatedAt)}
								</p>
							</div>

							<div class="flex items-center gap-2">
								<!-- Use/Active toggle -->
								<button
									type="button"
									onclick={() => handleSetActive(prompt)}
									class="rounded p-1.5 transition-colors {promptsState.activePromptId === prompt.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}"
									title={promptsState.activePromptId === prompt.id ? 'Deactivate' : 'Use for new chats'}
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</button>

								<!-- Set as default -->
								<button
									type="button"
									onclick={() => handleSetDefault(prompt)}
									class="rounded p-1.5 transition-colors {prompt.isDefault ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}"
									title={prompt.isDefault ? 'Remove as default' : 'Set as default'}
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill={prompt.isDefault ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
									</svg>
								</button>

								<!-- Edit -->
								<button
									type="button"
									onclick={() => openEditEditor(prompt)}
									class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
									title="Edit"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>

								<!-- Delete -->
								<button
									type="button"
									onclick={() => handleDelete(prompt)}
									class="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-900/30 hover:text-red-400"
									title="Delete"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Info section -->
		<section class="mt-8 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
			<h3 class="flex items-center gap-2 text-sm font-medium text-slate-300">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				How System Prompts Work
			</h3>
			<p class="mt-2 text-sm text-slate-400">
				System prompts define the AI's behavior, personality, and constraints. They're sent at the
				beginning of each conversation to set the context. Use them to create specialized assistants
				(e.g., code reviewer, writing helper) or to enforce specific response formats.
			</p>
			<p class="mt-2 text-sm text-slate-400">
				<strong class="text-slate-300">Default prompt:</strong> Automatically used for all new chats.
				<strong class="text-slate-300">Active prompt:</strong> Currently selected for your session.
			</p>
		</section>
	</div>
</div>

<!-- Editor Modal -->
{#if showEditor}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeEditor(); }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="editor-title"
	>
		<div class="w-full max-w-2xl rounded-xl bg-slate-800 shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-700 px-6 py-4">
				<h2 id="editor-title" class="text-lg font-semibold text-white">
					{editingPrompt ? 'Edit Prompt' : 'Create Prompt'}
				</h2>
				<button
					type="button"
					onclick={closeEditor}
					class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="p-6">
				<div class="space-y-4">
					<!-- Name -->
					<div>
						<label for="prompt-name" class="mb-1 block text-sm font-medium text-slate-300">
							Name <span class="text-red-400">*</span>
						</label>
						<input
							id="prompt-name"
							type="text"
							bind:value={formName}
							placeholder="e.g., Code Reviewer"
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							required
						/>
					</div>

					<!-- Description -->
					<div>
						<label for="prompt-description" class="mb-1 block text-sm font-medium text-slate-300">
							Description
						</label>
						<input
							id="prompt-description"
							type="text"
							bind:value={formDescription}
							placeholder="Brief description of this prompt's purpose"
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<!-- Content -->
					<div>
						<label for="prompt-content" class="mb-1 block text-sm font-medium text-slate-300">
							System Prompt <span class="text-red-400">*</span>
						</label>
						<textarea
							id="prompt-content"
							bind:value={formContent}
							placeholder="You are a helpful assistant that..."
							rows="8"
							class="w-full resize-none rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							required
						></textarea>
						<p class="mt-1 text-xs text-slate-500">
							{formContent.length} characters
						</p>
					</div>

					<!-- Default checkbox -->
					<div class="flex items-center gap-2">
						<input
							id="prompt-default"
							type="checkbox"
							bind:checked={formIsDefault}
							class="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
						/>
						<label for="prompt-default" class="text-sm text-slate-300">
							Set as default for new chats
						</label>
					</div>
				</div>

				<!-- Actions -->
				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={closeEditor}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSaving || !formName.trim() || !formContent.trim()}
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSaving ? 'Saving...' : editingPrompt ? 'Update' : 'Create'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
