<script lang="ts">
	/**
	 * CodeBlock - Syntax highlighted code with copy button and execution
	 * Uses Shiki for highlighting with a dark theme
	 * Supports running JavaScript and Python code in the browser
	 */

	import { codeToHtml, type BundledLanguage } from 'shiki';
	import { executionManager, isExecutable, getRuntime } from '$lib/execution';
	import type { ExecutionResult, ExecutionOutput } from '$lib/execution';

	interface Props {
		code: string;
		language?: string;
		/** Whether to show the run button for executable code */
		showRunButton?: boolean;
	}

	const { code, language = 'text', showRunButton = true }: Props = $props();

	// State for highlighted HTML and copy feedback
	let highlightedHtml = $state('');
	let isLoading = $state(true);
	let copied = $state(false);

	// Execution state
	let isExecuting = $state(false);
	let executionResult = $state<ExecutionResult | null>(null);
	let showOutput = $state(false);

	// Check if this code block is executable
	const canExecute = $derived(showRunButton && isExecutable(language) && executionManager.canExecute(language));

	// Map common language aliases
	const languageMap: Record<string, string> = {
		js: 'javascript',
		ts: 'typescript',
		py: 'python',
		rb: 'ruby',
		sh: 'bash',
		shell: 'bash',
		yml: 'yaml',
		md: 'markdown',
		json5: 'json',
		plaintext: 'text',
		txt: 'text'
	};

	/**
	 * Get the normalized language identifier
	 */
	function getNormalizedLanguage(lang: string): string {
		const normalized = lang.toLowerCase().trim();
		return languageMap[normalized] || normalized;
	}

	/**
	 * Highlight code using Shiki
	 */
	async function highlightCode(): Promise<void> {
		isLoading = true;

		try {
			const normalizedLang = getNormalizedLanguage(language);

			const html = await codeToHtml(code, {
				lang: normalizedLang as BundledLanguage,
				theme: 'github-dark'
			});

			highlightedHtml = html;
		} catch (error) {
			// Fallback to plain text if language not supported
			console.warn(`Language "${language}" not supported, falling back to plain text`);

			try {
				const html = await codeToHtml(code, {
					lang: 'text',
					theme: 'github-dark'
				});
				highlightedHtml = html;
			} catch {
				// Ultimate fallback - just escape and wrap
				highlightedHtml = `<pre class="shiki github-dark"><code>${escapeHtml(code)}</code></pre>`;
			}
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Escape HTML special characters
	 */
	function escapeHtml(text: string): string {
		const htmlEscapes: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		};
		return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
	}

	/**
	 * Copy code to clipboard
	 */
	async function handleCopy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy code:', error);
		}
	}

	/**
	 * Execute the code
	 */
	async function handleRun(): Promise<void> {
		if (!canExecute || isExecuting) return;

		isExecuting = true;
		showOutput = true;
		executionResult = null;

		try {
			executionResult = await executionManager.executeByLanguage(code, language);
		} catch (error) {
			executionResult = {
				status: 'error',
				outputs: [{
					type: 'error',
					content: error instanceof Error ? error.message : String(error),
					timestamp: 0
				}],
				duration: 0,
				error: error instanceof Error ? error.message : String(error)
			};
		} finally {
			isExecuting = false;
		}
	}

	/**
	 * Cancel execution
	 */
	function handleCancel(): void {
		const runtime = getRuntime(language);
		if (runtime) {
			executionManager.cancel(runtime);
		}
		isExecuting = false;
	}

	/**
	 * Toggle output visibility
	 */
	function toggleOutput(): void {
		showOutput = !showOutput;
	}

	/**
	 * Clear execution output
	 */
	function clearOutput(): void {
		executionResult = null;
		showOutput = false;
	}

	/**
	 * Get output class based on type
	 */
	function getOutputClass(type: ExecutionOutput['type']): string {
		switch (type) {
			case 'stdout':
				return 'text-gray-300';
			case 'stderr':
				return 'text-yellow-400';
			case 'error':
				return 'text-red-400';
			case 'result':
				return 'text-green-400';
			default:
				return 'text-gray-400';
		}
	}

	// Highlight code when component mounts or code/language changes
	$effect(() => {
		// Access reactive dependencies
		const _ = [code, language];
		highlightCode();
	});
</script>

<div class="group relative overflow-hidden rounded-lg">
	<!-- Header with language label, run button, and copy button -->
	<div
		class="flex items-center justify-between bg-gray-800 px-4 py-2 text-xs text-gray-400"
	>
		<span class="font-mono uppercase">{language}</span>
		<div class="flex items-center gap-2">
			<!-- Run button (for executable languages) -->
			{#if canExecute}
				{#if isExecuting}
					<button
						type="button"
						onclick={handleCancel}
						class="flex items-center gap-1 rounded bg-red-600/20 px-2 py-1 text-red-400 transition-colors hover:bg-red-600/30"
						aria-label="Cancel execution"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
						</svg>
						<span>Stop</span>
					</button>
				{:else}
					<button
						type="button"
						onclick={handleRun}
						class="flex items-center gap-1 rounded bg-emerald-600/20 px-2 py-1 text-emerald-400 transition-colors hover:bg-emerald-600/30"
						aria-label="Run code"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
							<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
						</svg>
						<span>Run</span>
					</button>
				{/if}
			{/if}

			<!-- Copy button -->
			<button
				type="button"
				onclick={handleCopy}
				class="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-gray-700 hover:text-gray-200"
				aria-label={copied ? 'Copied!' : 'Copy code'}
			>
				{#if copied}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-4 w-4 text-green-400"
					>
						<path
							fill-rule="evenodd"
							d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
							clip-rule="evenodd"
						/>
					</svg>
					<span class="text-green-400">Copied!</span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-4 w-4"
					>
						<path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
						<path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
					</svg>
					<span>Copy</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Code content -->
	<div class="overflow-x-auto bg-[#0d1117]">
		{#if isLoading}
			<pre class="p-4 font-mono text-sm text-gray-400"><code>{code}</code></pre>
		{:else}
			<div class="code-block-content">
				{@html highlightedHtml}
			</div>
		{/if}
	</div>

	<!-- Execution output -->
	{#if showOutput && (isExecuting || executionResult)}
		<div class="border-t border-gray-700 bg-[#161b22]">
			<!-- Output header -->
			<div class="flex items-center justify-between px-4 py-2 text-xs">
				<div class="flex items-center gap-2">
					<span class="font-medium text-gray-400">Output</span>
					{#if isExecuting}
						<span class="flex items-center gap-1 text-blue-400">
							<svg class="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Running...
						</span>
					{:else if executionResult}
						<span class="text-gray-500">
							{executionResult.duration}ms
						</span>
						{#if executionResult.status === 'success'}
							<span class="text-green-500">Success</span>
						{:else if executionResult.status === 'error'}
							<span class="text-red-500">Error</span>
						{/if}
					{/if}
				</div>
				<button
					type="button"
					onclick={clearOutput}
					class="rounded px-2 py-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
					aria-label="Clear output"
				>
					Clear
				</button>
			</div>

			<!-- Output content -->
			<div class="max-h-64 overflow-auto px-4 pb-4">
				{#if executionResult?.outputs.length}
					<pre class="font-mono text-sm">{#each executionResult.outputs as output}<span class={getOutputClass(output.type)}>{output.content}</span>
{/each}</pre>
				{:else if !isExecuting}
					<p class="text-sm italic text-gray-500">No output</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Override Shiki styles for consistent appearance */
	.code-block-content :global(pre) {
		@apply m-0 overflow-x-auto bg-transparent p-4;
	}

	.code-block-content :global(code) {
		@apply font-mono text-sm leading-relaxed;
	}

	.code-block-content :global(.line) {
		@apply block min-h-[1.5em];
	}

	/* Scrollbar styling for code blocks */
	.code-block-content :global(pre)::-webkit-scrollbar {
		height: 8px;
	}

	.code-block-content :global(pre)::-webkit-scrollbar-track {
		@apply bg-gray-800;
	}

	.code-block-content :global(pre)::-webkit-scrollbar-thumb {
		@apply rounded bg-gray-600;
	}

	.code-block-content :global(pre)::-webkit-scrollbar-thumb:hover {
		@apply bg-gray-500;
	}
</style>
