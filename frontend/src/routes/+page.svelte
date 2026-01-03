<script lang="ts">
	/**
	 * Home/new chat page
	 * Shows ChatWindow in "new chat" mode with welcome state
	 * When first message sent, creates conversation and continues streaming here
	 */

	import { onMount } from 'svelte';
	import { chatState, conversationsState, modelsState, toolsState, promptsState } from '$lib/stores';
	import { resolveSystemPrompt } from '$lib/services/prompt-resolution.js';
	import { streamingMetricsState } from '$lib/stores/streaming-metrics.svelte';
	import { settingsState } from '$lib/stores/settings.svelte';
	import { createConversation as createStoredConversation, addMessage as addStoredMessage, updateConversation } from '$lib/storage';
	import { ollamaClient } from '$lib/ollama';
	import type { OllamaMessage, OllamaToolDefinition, OllamaToolCall } from '$lib/ollama';
	import { getFunctionModel, USE_FUNCTION_MODEL, runToolCalls, formatToolResultsForChat } from '$lib/tools';
	import { searchSimilar, formatResultsAsContext, getKnowledgeBaseStats } from '$lib/memory';
	import ChatWindow from '$lib/components/chat/ChatWindow.svelte';
	import type { Conversation } from '$lib/types/conversation';

	// RAG state
	let ragEnabled = $state(true);
	let hasKnowledgeBase = $state(false);

	// Thinking mode state (for reasoning models)
	let thinkingEnabled = $state(true);

	// Derived: Check if selected model supports thinking
	const supportsThinking = $derived.by(() => {
		const caps = modelsState.selectedCapabilities;
		return caps.includes('thinking');
	});

	/**
	 * Get tool definitions for the API call
	 */
	function getToolsForApi(): OllamaToolDefinition[] | undefined {
		if (!toolsState.toolsEnabled) return undefined;
		const tools = toolsState.getEnabledToolDefinitions();
		return tools.length > 0 ? tools as OllamaToolDefinition[] : undefined;
	}

	// Reset chat state and check knowledge base on mount
	onMount(() => {
		chatState.reset();
		checkKnowledgeBase();
	});

	async function checkKnowledgeBase(): Promise<void> {
		try {
			const stats = await getKnowledgeBaseStats();
			hasKnowledgeBase = stats.documentCount > 0;
		} catch {
			hasKnowledgeBase = false;
		}
	}

	async function retrieveRagContext(query: string): Promise<string | null> {
		if (!ragEnabled || !hasKnowledgeBase) return null;
		try {
			const results = await searchSimilar(query, 3, 0.5);
			if (results.length === 0) return null;
			return formatResultsAsContext(results);
		} catch {
			return null;
		}
	}

	/**
	 * Handle first message submission
	 * Creates a new conversation and starts streaming the response
	 */
	async function handleFirstMessage(content: string, images?: string[]): Promise<void> {
		const model = modelsState.selectedId;
		if (!model) {
			console.error('No model selected');
			return;
		}

		const title = generateTitle(content);

		// Create conversation in IndexedDB
		const storageResult = await createStoredConversation({
			title,
			model,
			isPinned: false,
			isArchived: false
		});

		if (!storageResult.success) {
			console.error('Failed to create conversation:', storageResult.error);
			return;
		}

		const conversation = storageResult.data;
		const conversationId = conversation.id;

		// Add to conversations list (immediately updates sidenav via local state)
		conversationsState.add(conversation);

		// Update browser tab title
		currentTitle = title;

		// Set up chat state for the new conversation
		chatState.conversationId = conversationId;

		// Add user message to tree
		const userMessageId = chatState.addMessage({
			role: 'user',
			content,
			images
		});

		// Persist user message to IndexedDB with the SAME ID as chatState
		await addStoredMessage(conversationId, { role: 'user', content, images }, null, userMessageId);

		// Update URL without navigation (keeps ChatWindow mounted)
		history.replaceState({}, '', `/chat/${conversationId}`);

		// Start streaming response
		const assistantMessageId = chatState.startStreaming();

		// Start streaming metrics tracking
		streamingMetricsState.startStream();

		// Track tool calls
		let pendingToolCalls: OllamaToolCall[] | null = null;

		try {
			let messages: OllamaMessage[] = [{
				role: 'user',
				content,
				images
			}];

			// Build system prompt from resolution service + RAG context
			const systemParts: string[] = [];

			// Resolve system prompt using priority chain (model-aware)
			const resolvedPrompt = await resolveSystemPrompt(model, null, null);
			if (resolvedPrompt.content) {
				systemParts.push(resolvedPrompt.content);
			}

			// Add RAG context if available
			const ragContext = await retrieveRagContext(content);
			if (ragContext) {
				systemParts.push(`You have access to a knowledge base. Use the following relevant context to help answer the user's question. If the context isn't relevant, you can ignore it.\n\n${ragContext}`);
			}

			// Inject combined system message
			if (systemParts.length > 0) {
				const systemMessage: OllamaMessage = {
					role: 'system',
					content: systemParts.join('\n\n---\n\n')
				};
				messages = [systemMessage, ...messages];
			}

			const tools = getToolsForApi();

			// Use function model for tool routing if enabled
			const chatModel = (tools && tools.length > 0 && USE_FUNCTION_MODEL)
				? getFunctionModel(model)
				: model;

			// Determine if we should use native thinking mode
			const useNativeThinking = supportsThinking && thinkingEnabled;

			// Track thinking content during streaming
			let streamingThinking = '';
			let thinkingClosed = false;

			await ollamaClient.streamChatWithCallbacks(
				{ model: chatModel, messages, tools, think: useNativeThinking, options: settingsState.apiParameters },
				{
					onThinkingToken: (token) => {
						// Accumulate thinking and update the message
						if (!streamingThinking) {
							// Start the thinking block
							chatState.appendToStreaming('<think>');
						}
						streamingThinking += token;
						chatState.appendToStreaming(token);
						streamingMetricsState.incrementTokens();
					},
					onToken: (token) => {
						// Close thinking block when content starts
						if (streamingThinking && !thinkingClosed) {
							chatState.appendToStreaming('</think>\n\n');
							thinkingClosed = true;
						}
						chatState.appendToStreaming(token);
						streamingMetricsState.incrementTokens();
					},
					onToolCall: (toolCalls) => {
						pendingToolCalls = toolCalls;
					},
					onComplete: async () => {
						// Close thinking block if it was opened but not closed (e.g., tool calls without content)
						if (streamingThinking && !thinkingClosed) {
							chatState.appendToStreaming('</think>\n\n');
							thinkingClosed = true;
						}

						chatState.finishStreaming();
						streamingMetricsState.endStream();

						// Handle tool calls if received
						if (pendingToolCalls && pendingToolCalls.length > 0) {
							await executeToolsAndContinue(
								model,
								assistantMessageId,
								userMessageId,
								pendingToolCalls,
								conversationId
							);
							return;
						}

						// Persist assistant message with the SAME ID as chatState
						const node = chatState.messageTree.get(assistantMessageId);
						if (node) {
							await addStoredMessage(
								conversationId,
								{ role: 'assistant', content: node.message.content },
								userMessageId,
								assistantMessageId
							);
							await updateConversation(conversationId, {});
							conversationsState.update(conversationId, {});

							// Generate a smarter title in the background (don't await)
							generateSmartTitle(conversationId, content, node.message.content);
						}
					},
					onError: (error) => {
						console.error('Streaming error:', error);
						chatState.finishStreaming();
						streamingMetricsState.endStream();
					}
				}
			);
		} catch (error) {
			console.error('Failed to send message:', error);
			chatState.finishStreaming();
			streamingMetricsState.endStream();
		}
	}

	/**
	 * Execute tool calls and continue the conversation
	 */
	async function executeToolsAndContinue(
		model: string,
		assistantMessageId: string,
		userMessageId: string,
		toolCalls: OllamaToolCall[],
		conversationId: string
	): Promise<void> {
		try {
			// Convert tool calls to executor format with stable IDs
			const callIds = toolCalls.map(() => crypto.randomUUID());
			const convertedCalls = toolCalls.map((tc, i) => ({
				id: callIds[i],
				name: tc.function.name,
				arguments: tc.function.arguments
			}));

			// Execute all tools (including custom tools)
			const results = await runToolCalls(convertedCalls, undefined, toolsState.customTools);

			// Format results for model context (still needed for LLM to respond)
			const toolResultContent = formatToolResultsForChat(results);

			const assistantNode = chatState.messageTree.get(assistantMessageId);
			if (assistantNode) {
				// Store structured tool call data with results for display
				// Results are shown collapsed in ToolCallDisplay - NOT as raw message content
				assistantNode.message.toolCalls = toolCalls.map((tc, i) => {
					const result = results[i];
					return {
						id: callIds[i],
						name: tc.function.name,
						arguments: JSON.stringify(tc.function.arguments),
						result: result.success ? (typeof result.result === 'object' ? JSON.stringify(result.result) : String(result.result)) : undefined,
						error: result.success ? undefined : result.error
					};
				});

				// DON'T add tool results to message content - that's what floods the UI
				// The results are stored in toolCalls and displayed by ToolCallDisplay
			}

			// Persist tool call result (including any thinking content)
			await addStoredMessage(
				conversationId,
				{ role: 'assistant', content: assistantNode?.message.content || '' },
				userMessageId,
				assistantMessageId
			);

			// Add tool results as a hidden message (for model context, not displayed in UI)
			const toolMessageId = chatState.addMessage({
				role: 'user',
				content: `Tool execution results:\n${toolResultContent}\n\nBased on these results, either provide a helpful response OR call another tool if you need more information.`,
				hidden: true
			});

			await addStoredMessage(
				conversationId,
				{ role: 'user', content: `Tool execution results:\n${toolResultContent}` },
				assistantMessageId,
				toolMessageId
			);

			// Stream final response using original model - WITH tools so it can call more if needed
			const finalMessageId = chatState.startStreaming();

			// Continue metrics tracking for tool follow-up
			streamingMetricsState.startStream();

			// Use allMessages (including hidden) to send tool results to the model
			const apiMessages = chatState.allMessages.map(node => ({
				role: node.message.role,
				content: node.message.content,
				images: node.message.images
			})) as OllamaMessage[];

			// Track if model wants to call more tools
			let morePendingToolCalls: OllamaToolCall[] | null = null;

			// Pass tools again so model can chain tool calls
			const tools = getToolsForApi();

			await ollamaClient.streamChatWithCallbacks(
				{ model, messages: apiMessages, tools, options: settingsState.apiParameters },
				{
					onToken: (token) => {
						chatState.appendToStreaming(token);
						streamingMetricsState.incrementTokens();
					},
					onToolCall: (newToolCalls) => {
						morePendingToolCalls = newToolCalls;
					},
					onComplete: async () => {
						chatState.finishStreaming();
						streamingMetricsState.endStream();

						// If model wants to call more tools, recurse
						if (morePendingToolCalls && morePendingToolCalls.length > 0) {
							await executeToolsAndContinue(
								model,
								finalMessageId,
								toolMessageId,
								morePendingToolCalls,
								conversationId
							);
							return;
						}

						const node = chatState.messageTree.get(finalMessageId);
						if (node) {
							await addStoredMessage(
								conversationId,
								{ role: 'assistant', content: node.message.content },
								toolMessageId,
								finalMessageId
							);
							await updateConversation(conversationId, {});
							conversationsState.update(conversationId, {});
						}
					},
					onError: (error) => {
						console.error('Final response error:', error);
						chatState.finishStreaming();
						streamingMetricsState.endStream();
					}
				}
			);
		} catch (error) {
			console.error('Tool execution failed:', error);
			streamingMetricsState.endStream();
		}
	}

	/**
	 * Generate a title from the first message content
	 * Takes the first ~50 characters or first sentence
	 */
	function generateTitle(content: string): string {
		const firstLine = content.split('\n')[0].trim();
		const firstSentence = firstLine.split(/[.!?]/)[0].trim();

		if (firstSentence.length <= 50) {
			return firstSentence || 'New Chat';
		}

		return firstSentence.substring(0, 47) + '...';
	}

	/**
	 * Generate a better title using the LLM after the first response
	 * Runs in the background, doesn't block the UI
	 */
	async function generateSmartTitle(
		conversationId: string,
		userMessage: string,
		assistantMessage: string
	): Promise<void> {
		try {
			// Use a small, fast model for title generation if available, otherwise use selected
			const model = modelsState.selectedId;
			if (!model) {
				return;
			}

			// Strip thinking blocks from assistant message for cleaner title generation
			const cleanedAssistant = assistantMessage
				.replace(/<think>[\s\S]*?<\/think>/g, '')
				.replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
				.trim();

			// Build prompt - use assistant content if available, otherwise just user message
			const promptContent = cleanedAssistant.length > 0
				? `User: ${userMessage.substring(0, 200)}\n\nAssistant: ${cleanedAssistant.substring(0, 300)}`
				: `User message: ${userMessage.substring(0, 400)}`;

			const response = await ollamaClient.chat({
				model,
				messages: [
					{
						role: 'system',
						content: 'Generate a very short, concise title (3-6 words max) for this conversation. Output ONLY the title, no quotes, no explanation, no thinking.'
					},
					{
						role: 'user',
						content: promptContent
					}
				]
			});

			// Strip any thinking blocks from the title response and clean it up
			const newTitle = response.message.content
				.replace(/<think>[\s\S]*?<\/think>/g, '')
				.replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
				.trim()
				.replace(/^["']|["']$/g, '') // Remove quotes
				.replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
				.substring(0, 50);

			if (newTitle && newTitle.length > 0) {
				await updateConversation(conversationId, { title: newTitle });
				conversationsState.update(conversationId, { title: newTitle });
				currentTitle = newTitle;
			}
		} catch (error) {
			console.error('[NewChat] Failed to generate smart title:', error);
			// Silently fail - keep the original title
		}
	}

	// Track current chat title for browser tab
	let currentTitle = $state<string | null>(null);
</script>

<svelte:head>
	<title>{currentTitle ? `${currentTitle} - Vessel` : 'Vessel'}</title>
</svelte:head>

<div class="flex h-full flex-col">
	<ChatWindow mode="new" onFirstMessage={handleFirstMessage} bind:thinkingEnabled />
</div>
