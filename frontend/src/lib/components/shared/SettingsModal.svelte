<script lang="ts">
	/**
	 * SettingsModal - Application settings dialog
	 * Handles theme, model defaults, and other preferences
	 */

	import { modelsState, uiState } from '$lib/stores';
	import { getPrimaryModifierDisplay } from '$lib/utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	const { isOpen, onClose }: Props = $props();

	// Settings state (mirrors global state for editing)
	let defaultModel = $state<string | null>(null);

	// Sync with global state when modal opens
	$effect(() => {
		if (isOpen) {
			defaultModel = modelsState.selectedId;
		}
	});

	/**
	 * Save settings and close modal
	 */
	function handleSave(): void {
		if (defaultModel) {
			modelsState.select(defaultModel);
		}
		onClose();
	}

	/**
	 * Handle backdrop click
	 */
	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	/**
	 * Handle escape key
	 */
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	const modifierKey = getPrimaryModifierDisplay();
</script>

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-lg rounded-xl bg-theme-secondary shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-theme px-6 py-4">
				<h2 id="settings-title" class="text-lg font-semibold text-theme-primary">Settings</h2>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1.5 text-theme-muted hover:bg-theme-tertiary hover:text-theme-secondary"
					aria-label="Close settings"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-6 p-6">
				<!-- Appearance Section -->
				<section>
					<h3 class="mb-3 text-sm font-medium uppercase tracking-wide text-theme-muted">Appearance</h3>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-theme-secondary">Dark Mode</p>
								<p class="text-xs text-theme-muted">Toggle between light and dark theme</p>
							</div>
							<button
								type="button"
								onclick={() => uiState.toggleDarkMode()}
								class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-theme {uiState.darkMode ? 'bg-emerald-600' : 'bg-theme-tertiary'}"
								role="switch"
								aria-checked={uiState.darkMode}
							>
								<span
									class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {uiState.darkMode ? 'translate-x-5' : 'translate-x-0'}"
								></span>
							</button>
						</div>
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-theme-secondary">Use System Theme</p>
								<p class="text-xs text-theme-muted">Match your OS light/dark preference</p>
							</div>
							<button
								type="button"
								onclick={() => uiState.useSystemTheme()}
								class="rounded-lg bg-theme-tertiary px-3 py-1.5 text-xs font-medium text-theme-secondary transition-colors hover:bg-theme-tertiary"
							>
								Sync with System
							</button>
						</div>
					</div>
				</section>

				<!-- Model Section -->
				<section>
					<h3 class="mb-3 text-sm font-medium uppercase tracking-wide text-theme-muted">Default Model</h3>
					<div class="space-y-4">
						<div>
							<select
								bind:value={defaultModel}
								class="w-full rounded-lg border border-theme-subtle bg-theme-tertiary px-3 py-2 text-theme-secondary focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								{#each modelsState.chatModels as model}
									<option value={model.name}>{model.name}</option>
								{/each}
							</select>
							<p class="mt-1 text-sm text-theme-muted">Model used for new conversations</p>
						</div>
					</div>
				</section>

				<!-- Keyboard Shortcuts Section -->
				<section>
					<h3 class="mb-3 text-sm font-medium uppercase tracking-wide text-theme-muted">Keyboard Shortcuts</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between text-theme-secondary">
							<span>New Chat</span>
							<kbd class="rounded bg-theme-tertiary px-2 py-0.5 font-mono text-theme-muted">{modifierKey}+N</kbd>
						</div>
						<div class="flex justify-between text-theme-secondary">
							<span>Search</span>
							<kbd class="rounded bg-theme-tertiary px-2 py-0.5 font-mono text-theme-muted">{modifierKey}+K</kbd>
						</div>
						<div class="flex justify-between text-theme-secondary">
							<span>Toggle Sidebar</span>
							<kbd class="rounded bg-theme-tertiary px-2 py-0.5 font-mono text-theme-muted">{modifierKey}+B</kbd>
						</div>
						<div class="flex justify-between text-theme-secondary">
							<span>Send Message</span>
							<kbd class="rounded bg-theme-tertiary px-2 py-0.5 font-mono text-theme-muted">Enter</kbd>
						</div>
						<div class="flex justify-between text-theme-secondary">
							<span>New Line</span>
							<kbd class="rounded bg-theme-tertiary px-2 py-0.5 font-mono text-theme-muted">Shift+Enter</kbd>
						</div>
					</div>
				</section>

				<!-- About Section -->
				<section>
					<h3 class="mb-3 text-sm font-medium uppercase tracking-wide text-theme-muted">About</h3>
					<div class="rounded-lg bg-theme-tertiary/50 p-4">
						<p class="font-medium text-theme-secondary">Ollama Web UI</p>
						<p class="mt-1 text-sm text-theme-muted">
							A feature-rich web interface for Ollama with chat, tools, and memory management.
						</p>
					</div>
				</section>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-3 border-t border-theme px-6 py-4">
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg px-4 py-2 text-sm font-medium text-theme-secondary hover:bg-theme-tertiary"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSave}
					class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
