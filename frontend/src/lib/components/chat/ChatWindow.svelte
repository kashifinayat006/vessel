<script lang="ts">
	/**
	 * ChatWindow - Main container for the chat interface
	 * Handles sending messages, streaming responses, and tool execution
	 */

	import { chatState, modelsState, conversationsState, toolsState, promptsState } from '$lib/stores';
	import { ollamaClient } from '$lib/ollama';
	import { addMessage as addStoredMessage, updateConversation, createConversation as createStoredConversation } from '$lib/storage';
	import {
		contextManager,
		generateSummary,
		selectMessagesForSummarization,
		calculateTokenSavings,
		formatSummaryAsContext,
		searchSimilar,
		formatResultsAsContext,
		getKnowledgeBaseStats
	} from '$lib/memory';
	import { runToolCalls, formatToolResultsForChat, getFunctionModel, USE_FUNCTION_MODEL } from '$lib/tools';
	import type { OllamaMessage, OllamaToolCall, OllamaToolDefinition } from '$lib/ollama';
	import type { Conversation } from '$lib/types/conversation';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import EmptyState from './EmptyState.svelte';
	import ContextUsageBar from './ContextUsageBar.svelte';
	import SummaryBanner from './SummaryBanner.svelte';

	/**
	 * Props interface for ChatWindow
	 * - mode: 'new' for new chat page, 'conversation' for existing conversations
	 * - onFirstMessage: callback for when first message is sent in 'new' mode
	 * - conversation: conversation metadata when in 'conversation' mode
	 */
	interface Props {
		mode?: 'new' | 'conversation';
		onFirstMessage?: (content: string, images?: string[]) => Promise<void>;
		conversation?: Conversation | null;
	}

	let { mode = 'new', onFirstMessage, conversation }: Props = $props();

	// Local state for abort controller
	let abortController: AbortController | null = $state(null);

	// Summarization state
	let isSummarizing = $state(false);

	// Tool execution state
	let isExecutingTools = $state(false);

	// RAG (Retrieval-Augmented Generation) state
	let ragEnabled = $state(true);
	let hasKnowledgeBase = $state(false);
	let lastRagContext = $state<string | null>(null);

	// Check for knowledge base on mount
	$effect(() => {
		checkKnowledgeBase();
	});

	/**
	 * Check if knowledge base has any documents
	 */
	async function checkKnowledgeBase(): Promise<void> {
		try {
			const stats = await getKnowledgeBaseStats();
			hasKnowledgeBase = stats.documentCount > 0;
		} catch {
			hasKnowledgeBase = false;
		}
	}

	/**
	 * Retrieve relevant context from knowledge base for the query
	 */
	async function retrieveRagContext(query: string): Promise<string | null> {
		if (!ragEnabled || !hasKnowledgeBase) return null;

		try {
			const results = await searchSimilar(query, 3, 0.5);
			if (results.length === 0) return null;

			const context = formatResultsAsContext(results);
			console.log('[RAG] Retrieved', results.length, 'chunks for context');
			return context;
		} catch (error) {
			console.error('[RAG] Failed to retrieve context:', error);
			return null;
		}
	}

	/**
	 * Convert OllamaToolCall to the format expected by tool executor
	 * Ollama doesn't provide IDs, so we generate them
	 */
	function convertToolCalls(ollamaCalls: OllamaToolCall[]): Array<{ id: string; function: { name: string; arguments: string } }> {
		return ollamaCalls.map((call, index) => ({
			id: `tool-${Date.now()}-${index}`,
			function: {
				name: call.function.name,
				arguments: JSON.stringify(call.function.arguments)
			}
		}));
	}

	/**
	 * Get tool definitions for the API call
	 */
	function getToolsForApi(): OllamaToolDefinition[] | undefined {
		if (!toolsState.toolsEnabled) return undefined;
		const tools = toolsState.getEnabledToolDefinitions();
		return tools.length > 0 ? tools as OllamaToolDefinition[] : undefined;
	}

	// Derived: Check if there are any messages
	const hasMessages = $derived(chatState.visibleMessages.length > 0);

	// Update context manager when model changes
	$effect(() => {
		const model = modelsState.selectedId;
		if (model) {
			contextManager.setModel(model);
		}
	});

	// Update context manager when messages change
	$effect(() => {
		contextManager.updateMessages(chatState.visibleMessages);
	});

	// Invalidate streaming message token cache on content update
	// Only do this occasionally (the throttling in contextManager handles the rest)
	$effect(() => {
		if (chatState.streamingMessageId && chatState.streamBuffer) {
			contextManager.invalidateMessage(chatState.streamingMessageId);
		}
	});

	// Flush pending context updates when streaming finishes
	$effect(() => {
		if (!chatState.isStreaming) {
			// Force a full context update when streaming ends
			contextManager.flushPendingUpdate();
			contextManager.updateMessages(chatState.visibleMessages, true);
		}
	});

	/**
	 * Convert chat state messages to Ollama API format
	 */
	function getMessagesForApi(): OllamaMessage[] {
		return chatState.visibleMessages.map((node) => ({
			role: node.message.role as OllamaMessage['role'],
			content: node.message.content,
			images: node.message.images
		}));
	}

	/**
	 * Handle summarization of older messages
	 */
	async function handleSummarize(): Promise<void> {
		const selectedModel = modelsState.selectedId;
		if (!selectedModel || isSummarizing) return;

		const messages = chatState.visibleMessages;
		const { toSummarize, toKeep } = selectMessagesForSummarization(messages, 0);

		if (toSummarize.length === 0) {
			console.log('No messages to summarize');
			return;
		}

		isSummarizing = true;

		try {
			// Generate summary using the LLM
			const summary = await generateSummary(toSummarize, selectedModel);
			const formattedSummary = formatSummaryAsContext(summary);

			// Calculate savings for logging
			const savedTokens = calculateTokenSavings(toSummarize, formattedSummary);
			console.log(`Summarization saved ~${savedTokens} tokens`);

			// For now, we'll log the summary - full implementation would
			// replace the old messages with the summary in the chat state
			console.log('Summary generated:', summary);

			// TODO: Implement message replacement in chat state
			// This requires adding a method to ChatState to replace messages
			// with a summary node

		} catch (error) {
			console.error('Summarization failed:', error);
		} finally {
			isSummarizing = false;
		}
	}

	/**
	 * Send a message and stream the response (with tool support)
	 */
	async function handleSendMessage(content: string, images?: string[]): Promise<void> {
		console.log('[Chat] handleSendMessage called:', content.substring(0, 50));
		const selectedModel = modelsState.selectedId;

		if (!selectedModel) {
			console.error('No model selected');
			return;
		}

		// In 'new' mode with no messages yet, create conversation first
		if (mode === 'new' && !hasMessages && onFirstMessage) {
			await onFirstMessage(content, images);
			return;
		}

		let conversationId = chatState.conversationId;

		// Auto-create conversation if none exists (fallback for edge cases)
		if (!conversationId) {
			const title = content.length > 50 ? content.substring(0, 47) + '...' : content;
			const result = await createStoredConversation({
				title,
				model: selectedModel,
				isPinned: false,
				isArchived: false
			});

			if (result.success) {
				conversationId = result.data.id;
				chatState.conversationId = conversationId;
				conversationsState.add(result.data);
			}
		}

		// Add user message to tree
		const userMessageId = chatState.addMessage({
			role: 'user',
			content,
			images
		});

		// Persist user message to IndexedDB with the SAME ID as chatState
		if (conversationId) {
			const parentId = chatState.activePath.length >= 2
				? chatState.activePath[chatState.activePath.length - 2]
				: null;
			await addStoredMessage(conversationId, { role: 'user', content, images }, parentId, userMessageId);
		}

		// Stream assistant message with optional tool support
		await streamAssistantResponse(selectedModel, userMessageId, conversationId);
	}

	/**
	 * Stream assistant response with tool call handling and RAG context
	 */
	async function streamAssistantResponse(
		model: string,
		parentMessageId: string,
		conversationId: string | null
	): Promise<void> {
		console.log('[Chat] streamAssistantResponse called with model:', model);
		const assistantMessageId = chatState.startStreaming();
		abortController = new AbortController();

		// Track tool calls received during streaming
		let pendingToolCalls: OllamaToolCall[] | null = null;

		try {
			let messages = getMessagesForApi();
			const tools = getToolsForApi();

			// Build system prompt from active prompt + RAG context
			const systemParts: string[] = [];

			// Wait for prompts to be loaded, then add system prompt if active
			await promptsState.ready();
			const activePrompt = promptsState.activePrompt;
			if (activePrompt) {
				systemParts.push(activePrompt.content);
				console.log('[Chat] Using system prompt:', activePrompt.name);
			}

			// RAG: Retrieve relevant context for the last user message
			const lastUserMessage = messages.filter(m => m.role === 'user').pop();
			if (lastUserMessage && ragEnabled && hasKnowledgeBase) {
				const ragContext = await retrieveRagContext(lastUserMessage.content);
				if (ragContext) {
					lastRagContext = ragContext;
					systemParts.push(`You have access to a knowledge base. Use the following relevant context to help answer the user's question. If the context isn't relevant, you can ignore it.\n\n${ragContext}`);
					console.log('[RAG] Injected context into conversation');
				}
			}

			// Inject combined system message
			if (systemParts.length > 0) {
				const systemMessage: OllamaMessage = {
					role: 'system',
					content: systemParts.join('\n\n---\n\n')
				};
				messages = [systemMessage, ...messages];
			}

			// Use function model for tool routing if enabled and tools are present
			const chatModel = (tools && tools.length > 0 && USE_FUNCTION_MODEL)
				? getFunctionModel(model)
				: model;

			// Debug logging
			console.log('[Chat] Tools enabled:', toolsState.toolsEnabled);
			console.log('[Chat] Tools count:', tools?.length ?? 0);
			console.log('[Chat] Tool names:', tools?.map(t => t.function.name) ?? []);
			console.log('[Chat] USE_FUNCTION_MODEL:', USE_FUNCTION_MODEL);
			console.log('[Chat] Using model:', chatModel, '(original:', model, ')');

			await ollamaClient.streamChatWithCallbacks(
				{
					model: chatModel,
					messages,
					tools
				},
				{
					onToken: (token) => {
						chatState.appendToStreaming(token);
					},
					onToolCall: (toolCalls) => {
						// Store tool calls to process after streaming completes
						pendingToolCalls = toolCalls;
						console.log('Tool calls received:', toolCalls);
					},
					onComplete: async () => {
						chatState.finishStreaming();
						abortController = null;

						// Handle tool calls if received
						if (pendingToolCalls && pendingToolCalls.length > 0) {
							await executeToolsAndContinue(
								model,
								assistantMessageId,
								pendingToolCalls,
								conversationId
							);
							return; // Tool continuation handles persistence
						}

						// Persist assistant message to IndexedDB with the SAME ID as chatState
						if (conversationId) {
							const node = chatState.messageTree.get(assistantMessageId);
							if (node) {
								await addStoredMessage(
									conversationId,
									{ role: 'assistant', content: node.message.content },
									parentMessageId,
									assistantMessageId
								);
								await updateConversation(conversationId, {});
								conversationsState.update(conversationId, {});
							}
						}
					},
					onError: (error) => {
						console.error('Streaming error:', error);
						chatState.finishStreaming();
						abortController = null;
					}
				},
				abortController.signal
			);
		} catch (error) {
			console.error('Failed to send message:', error);
			chatState.finishStreaming();
			abortController = null;
		}
	}

	/**
	 * Execute tool calls and continue the conversation with results
	 */
	async function executeToolsAndContinue(
		model: string,
		assistantMessageId: string,
		toolCalls: OllamaToolCall[],
		conversationId: string | null
	): Promise<void> {
		isExecutingTools = true;

		try {
			// Convert tool calls to executor format
			const convertedCalls = convertToolCalls(toolCalls);

			// Execute all tools (including custom tools)
			const results = await runToolCalls(convertedCalls, undefined, toolsState.customTools);

			// Format results for chat
			const toolResultContent = formatToolResultsForChat(results);

			// Add the assistant's tool call response to chat (with info about what was called)
			const toolCallInfo = toolCalls
				.map(tc => `Called tool: ${tc.function.name}(${JSON.stringify(tc.function.arguments)})`)
				.join('\n');

			// Update the assistant message with tool call info and structured data
			const assistantNode = chatState.messageTree.get(assistantMessageId);
			if (assistantNode) {
				assistantNode.message.content = toolCallInfo + '\n\n' + toolResultContent;
				// Store structured tool call data for display
				assistantNode.message.toolCalls = toolCalls.map(tc => ({
					id: crypto.randomUUID(),
					name: tc.function.name,
					arguments: JSON.stringify(tc.function.arguments)
				}));
			}

			// Persist the assistant message with tool info
			if (conversationId) {
				const parentNode = chatState.messageTree.get(assistantMessageId);
				if (parentNode) {
					const parentOfAssistant = parentNode.parentId;
					await addStoredMessage(
						conversationId,
						{ role: 'assistant', content: toolCallInfo + '\n\n' + toolResultContent },
						parentOfAssistant,
						assistantMessageId
					);
				}
			}

			// Now stream a follow-up response that uses the tool results
			// Add tool results as a system/tool message to context
			const toolMessageId = chatState.addMessage({
				role: 'user', // Ollama expects tool results in a user-like message
				content: `Tool execution results:\n${toolResultContent}\n\nPlease provide a response based on these results.`
			});

			if (conversationId) {
				await addStoredMessage(
					conversationId,
					{ role: 'user', content: `Tool execution results:\n${toolResultContent}` },
					assistantMessageId,
					toolMessageId
				);
			}

			// Stream the final response
			await streamAssistantResponse(model, toolMessageId, conversationId);

		} catch (error) {
			console.error('Tool execution failed:', error);
			// Update assistant message with error
			const node = chatState.messageTree.get(assistantMessageId);
			if (node) {
				node.message.content = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
			}
		} finally {
			isExecutingTools = false;
		}
	}

	/**
	 * Stop the current streaming response
	 */
	function handleStopStreaming(): void {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		chatState.finishStreaming();
	}

	/**
	 * Regenerate the last assistant response
	 * Creates a new sibling message for the assistant response and streams a new answer
	 */
	async function handleRegenerate(): Promise<void> {
		if (!chatState.canRegenerate) return;

		const selectedModel = modelsState.selectedId;
		if (!selectedModel) return;

		// Get the last message (should be an assistant message)
		const lastMessageId = chatState.activePath[chatState.activePath.length - 1];
		const lastNode = chatState.messageTree.get(lastMessageId);
		if (!lastNode || lastNode.message.role !== 'assistant') return;

		const conversationId = chatState.conversationId;

		// Use the new startRegeneration method which creates a sibling and sets up streaming
		const newMessageId = chatState.startRegeneration(lastMessageId);
		if (!newMessageId) {
			console.error('Failed to start regeneration');
			return;
		}

		// Get the parent user message for context
		const parentUserMessage = chatState.getParentUserMessage(newMessageId);
		const parentUserMessageId = parentUserMessage?.id;

		abortController = new AbortController();

		// Track tool calls received during streaming
		let pendingToolCalls: OllamaToolCall[] | null = null;

		try {
			// Get messages for API - excludes the current empty assistant message being streamed
			const messages = getMessagesForApi().filter(m => m.content !== '');
			const tools = getToolsForApi();

			// Use function model for tool routing if enabled and tools are present
			const chatModel = (tools && tools.length > 0 && USE_FUNCTION_MODEL)
				? getFunctionModel(selectedModel)
				: selectedModel;

			await ollamaClient.streamChatWithCallbacks(
				{
					model: chatModel,
					messages,
					tools
				},
				{
					onToken: (token) => {
						chatState.appendToStreaming(token);
					},
					onToolCall: (toolCalls) => {
						pendingToolCalls = toolCalls;
					},
					onComplete: async () => {
						chatState.finishStreaming();
						abortController = null;

						// Handle tool calls if received
						if (pendingToolCalls && pendingToolCalls.length > 0) {
							await executeToolsAndContinue(
								selectedModel,
								newMessageId,
								pendingToolCalls,
								conversationId
							);
							return;
						}

						// Persist regenerated assistant message to IndexedDB with the SAME ID
						if (conversationId && parentUserMessageId) {
							const node = chatState.messageTree.get(newMessageId);
							if (node) {
								await addStoredMessage(
									conversationId,
									{ role: 'assistant', content: node.message.content },
									parentUserMessageId,
									newMessageId
								);
								// Update conversation timestamp
								await updateConversation(conversationId, {});
								conversationsState.update(conversationId, {});
							}
						}
					},
					onError: (error) => {
						console.error('Regenerate error:', error);
						chatState.finishStreaming();
						abortController = null;
					}
				},
				abortController.signal
			);
		} catch (error) {
			console.error('Failed to regenerate:', error);
			chatState.finishStreaming();
			abortController = null;
		}
	}

	/**
	 * Edit a user message and regenerate
	 * Creates a new sibling user message and triggers a new assistant response
	 */
	async function handleEditMessage(messageId: string, newContent: string): Promise<void> {
		const selectedModel = modelsState.selectedId;
		if (!selectedModel) return;

		// Find the message
		const node = chatState.messageTree.get(messageId);
		if (!node || node.message.role !== 'user') return;

		const conversationId = chatState.conversationId;

		// Use the new startEditWithNewBranch method which creates a sibling user message
		const newUserMessageId = chatState.startEditWithNewBranch(
			messageId,
			newContent,
			node.message.images
		);

		if (!newUserMessageId) {
			console.error('Failed to create edited message branch');
			return;
		}

		// Persist the new user message to IndexedDB with the SAME ID
		if (conversationId) {
			// Get the parent of the original message (which is also the parent of our new message)
			const parentId = node.parentId;
			await addStoredMessage(
				conversationId,
				{ role: 'user', content: newContent, images: node.message.images },
				parentId,
				newUserMessageId
			);
		}

		// Stream the response using the shared function (with tool support)
		await streamAssistantResponse(selectedModel, newUserMessageId, conversationId);
	}
</script>

<div class="flex h-full flex-col">
	{#if hasMessages}
		<div class="flex-1 overflow-hidden">
			<MessageList
				onRegenerate={handleRegenerate}
				onEditMessage={handleEditMessage}
			/>
		</div>
	{:else}
		<div class="flex flex-1 items-center justify-center">
			<EmptyState />
		</div>
	{/if}

	<div class="border-t border-gray-200 dark:border-gray-700">
		<!-- Summary recommendation banner -->
		<SummaryBanner onSummarize={handleSummarize} isLoading={isSummarizing} />

		<!-- Context usage indicator -->
		{#if hasMessages}
			<div class="px-4 pt-3">
				<ContextUsageBar />
			</div>
		{/if}

		<div class="p-4 pt-2">
			<ChatInput
				onSend={handleSendMessage}
				onStop={handleStopStreaming}
				isStreaming={chatState.isStreaming}
				disabled={!modelsState.selectedId}
			/>
		</div>
	</div>
</div>
