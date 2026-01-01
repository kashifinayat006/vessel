<script lang="ts">
	/**
	 * EmptyState - Displayed when there are no messages
	 * Shows a welcome message and quick-start suggestions that set system prompts
	 */

	import { modelsState, promptsState } from '$lib/stores';

	const selectedModel = $derived(modelsState.selected);
	const hasModel = $derived(!!modelsState.selectedId);

	/** Quick-start prompt definitions */
	const QUICK_PROMPTS = {
		question: {
			name: 'Knowledge Assistant',
			content: `You are a knowledgeable assistant focused on providing clear, accurate explanations. When answering questions:
- Break down complex topics into understandable parts
- Use examples and analogies when helpful
- Cite sources or indicate uncertainty when appropriate
- Ask clarifying questions if the query is ambiguous
- Provide both concise answers and deeper context when relevant`
		},
		code: {
			name: 'Code Assistant',
			content: `You are an expert programming assistant. When helping with code:
- Write clean, well-documented code with clear variable names
- Explain your implementation choices and trade-offs
- Consider edge cases and error handling
- Follow language-specific best practices and idioms
- Suggest improvements and optimizations when appropriate
- If debugging, ask for error messages and context`
		},
		content: {
			name: 'Content Creator',
			content: `You are a skilled content creator and writing assistant. When creating content:
- Adapt tone and style to the target audience
- Use clear, engaging language appropriate to the format
- Structure content logically with good flow
- Proofread for grammar, clarity, and consistency
- Ask about purpose, audience, and tone preferences if not specified
- Offer variations or alternatives when helpful`
		},
		conversation: {
			name: 'Conversation Partner',
			content: `You are an engaging conversation partner focused on thoughtful discussion. In conversations:
- Listen actively and ask insightful follow-up questions
- Share relevant perspectives and ideas while staying open-minded
- Help develop and refine ideas through dialogue
- Provide honest feedback while being constructive
- Connect related topics and draw interesting parallels
- Keep discussions focused but allow natural tangents`
		}
	} as const;

	type PromptType = keyof typeof QUICK_PROMPTS;

	/** Currently selected quick prompt */
	const activeQuickPrompt = $derived(promptsState.temporaryPrompt?.name);

	/**
	 * Select a quick-start prompt
	 */
	function selectPrompt(type: PromptType): void {
		const prompt = QUICK_PROMPTS[type];
		promptsState.setTemporaryPrompt(prompt.name, prompt.content);
	}

	/**
	 * Check if a prompt type is currently active
	 */
	function isActive(type: PromptType): boolean {
		return activeQuickPrompt === QUICK_PROMPTS[type].name;
	}
</script>

<div class="flex flex-col items-center justify-center px-4 py-12 text-center">
	<!-- Logo/Icon - Vessel V with violet gradient -->
	<div
		class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			class="h-8 w-8"
		>
			<defs>
				<linearGradient id="vessel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#a78bfa"/>
					<stop offset="100%" stop-color="#818cf8"/>
				</linearGradient>
			</defs>
			<path d="M12 21 L3 6 Q3 4.5 4.5 4.5 L7.5 4.5 L12 13.5 L16.5 4.5 L19.5 4.5 Q21 4.5 21 6 L12 21 Z" fill="url(#vessel-gradient)"/>
		</svg>
	</div>

	<!-- Welcome text -->
	<h2 class="mb-2 text-xl font-medium text-theme-primary">
		{#if hasModel}
			Start a conversation
		{:else}
			No model selected
		{/if}
	</h2>

	<p class="mb-8 max-w-md text-sm text-theme-muted">
		{#if hasModel && selectedModel}
			Chatting with <span class="font-medium text-theme-secondary">{selectedModel.name}</span>
		{:else}
			Select a model from the sidebar to start chatting
		{/if}
	</p>

	<!-- Quick-start suggestion cards -->
	{#if hasModel}
		<div class="grid max-w-xl gap-2 sm:grid-cols-2">
			{@render SuggestionCard({
				type: "question",
				icon: "lightbulb",
				title: "Ask a question",
				description: "Get explanations on any topic"
			})}
			{@render SuggestionCard({
				type: "code",
				icon: "code",
				title: "Write code",
				description: "Generate or debug code"
			})}
			{@render SuggestionCard({
				type: "content",
				icon: "pencil",
				title: "Create content",
				description: "Draft emails or articles"
			})}
			{@render SuggestionCard({
				type: "conversation",
				icon: "chat",
				title: "Have a conversation",
				description: "Discuss ideas and brainstorm"
			})}
		</div>

		<!-- Active prompt indicator -->
		{#if activeQuickPrompt}
			<p class="mt-4 text-xs text-violet-400/70">
				<span class="inline-flex items-center gap-1.5">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3">
						<path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
					</svg>
					{activeQuickPrompt} mode active
				</span>
			</p>
		{/if}
	{/if}
</div>

{#snippet SuggestionCard(props: { type: PromptType; icon: string; title: string; description: string })}
	{@const active = isActive(props.type)}
	<button
		type="button"
		onclick={() => selectPrompt(props.type)}
		class="flex items-start gap-3 rounded-xl border p-3 text-left transition-all {active
			? 'border-violet-500/50 bg-violet-500/10'
			: 'border-theme hover:border-theme-subtle bg-theme-secondary/30 hover:bg-theme-secondary/60'}"
	>
		<div class="flex-shrink-0 {active ? 'text-violet-400' : 'text-theme-muted'}">
			{#if props.icon === 'lightbulb'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
					<path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
				</svg>
			{:else if props.icon === 'code'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
					<path fill-rule="evenodd" d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06zM11.377 2.011a.75.75 0 01.612.867l-2.5 14.5a.75.75 0 01-1.478-.255l2.5-14.5a.75.75 0 01.866-.612z" clip-rule="evenodd" />
				</svg>
			{:else if props.icon === 'pencil'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
					<path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
				</svg>
			{:else if props.icon === 'chat'}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
					<path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293c.121-.233.362-.393.642-.413a41.102 41.102 0 003.55-.414c1.437-.232 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zM6.75 6a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 2.5a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clip-rule="evenodd" />
				</svg>
			{/if}
		</div>
		<div>
			<h3 class="text-sm font-medium {active ? 'text-violet-200 dark:text-violet-200' : 'text-theme-primary'}">{props.title}</h3>
			<p class="text-xs {active ? 'text-violet-400/70' : 'text-theme-muted'}">{props.description}</p>
		</div>
	</button>
{/snippet}
