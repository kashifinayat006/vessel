/**
 * Project Context Service
 * Builds full project context for chat messages including:
 * - Project instructions
 * - Conversation summaries from other project chats
 * - RAG search across project chat history
 * - Project reference links
 */

import { db } from '$lib/storage/db.js';
import { getProjectConversationSummaries } from '$lib/storage/conversations.js';
import type { ProjectLink } from '$lib/storage/projects.js';
import { getProjectLinks } from '$lib/storage/projects.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationSummary {
	id: string;
	title: string;
	summary: string;
	updatedAt: Date;
}

export interface ChatHistoryResult {
	conversationId: string;
	conversationTitle: string;
	content: string;
	similarity: number;
}

export interface ProjectContext {
	/** Project instructions to inject into system prompt */
	instructions: string | null;
	/** Summaries of other conversations in the project */
	conversationSummaries: ConversationSummary[];
	/** Relevant snippets from chat history RAG search */
	relevantChatHistory: ChatHistoryResult[];
	/** Reference links for the project */
	links: ProjectLink[];
}

// ============================================================================
// Main Context Builder
// ============================================================================

/**
 * Build full project context for a chat message
 * @param projectId - The project ID
 * @param currentConversationId - The current conversation (excluded from summaries/RAG)
 * @param userQuery - The user's message (used for RAG search)
 * @returns ProjectContext with all relevant context
 */
export async function buildProjectContext(
	projectId: string,
	currentConversationId: string,
	userQuery: string
): Promise<ProjectContext> {
	// Fetch project data in parallel
	const [project, summariesResult, linksResult, chatHistory] = await Promise.all([
		db.projects.get(projectId),
		getProjectConversationSummaries(projectId, currentConversationId),
		getProjectLinks(projectId),
		searchProjectChatHistory(projectId, userQuery, currentConversationId, 3)
	]);

	const summaries = summariesResult.success ? summariesResult.data : [];
	const links = linksResult.success ? linksResult.data : [];

	return {
		instructions: project?.instructions || null,
		conversationSummaries: summaries.map((s) => ({
			id: s.id,
			title: s.title,
			summary: s.summary,
			updatedAt: s.updatedAt
		})),
		relevantChatHistory: chatHistory,
		links
	};
}

// ============================================================================
// Chat History RAG Search
// ============================================================================

/**
 * Search across project chat history using embeddings
 * Returns relevant snippets from other conversations in the project
 */
export async function searchProjectChatHistory(
	projectId: string,
	query: string,
	excludeConversationId?: string,
	topK: number = 3,
	threshold: number = 0.5
): Promise<ChatHistoryResult[]> {
	// Get all chat chunks for this project
	const chunks = await db.chatChunks
		.where('projectId')
		.equals(projectId)
		.toArray();

	// Filter out current conversation
	const relevantChunks = excludeConversationId
		? chunks.filter((c) => c.conversationId !== excludeConversationId)
		: chunks;

	if (relevantChunks.length === 0) {
		return [];
	}

	// For now, return empty - embeddings require Ollama API
	// This will be populated when chat-indexer.ts is implemented
	// and conversations are indexed
	return [];
}

// ============================================================================
// Context Formatting
// ============================================================================

/**
 * Format project context for injection into system prompt
 */
export function formatProjectContextForPrompt(context: ProjectContext): string {
	const parts: string[] = [];

	// Project instructions
	if (context.instructions && context.instructions.trim()) {
		parts.push(`## Project Instructions\n${context.instructions}`);
	}

	// Conversation summaries
	if (context.conversationSummaries.length > 0) {
		const summariesText = context.conversationSummaries
			.slice(0, 5) // Limit to 5 most recent
			.map((s) => `- **${s.title}**: ${s.summary}`)
			.join('\n');
		parts.push(`## Previous Discussions in This Project\n${summariesText}`);
	}

	// Relevant chat history (RAG results)
	if (context.relevantChatHistory.length > 0) {
		const historyText = context.relevantChatHistory
			.map((h) => `From "${h.conversationTitle}":\n${h.content}`)
			.join('\n\n---\n\n');
		parts.push(`## Relevant Context from Past Conversations\n${historyText}`);
	}

	// Reference links
	if (context.links.length > 0) {
		const linksText = context.links
			.slice(0, 5) // Limit to 5 links
			.map((l) => `- [${l.title}](${l.url})${l.description ? `: ${l.description}` : ''}`)
			.join('\n');
		parts.push(`## Project Reference Links\n${linksText}`);
	}

	return parts.join('\n\n');
}

/**
 * Check if project context has any content worth injecting
 */
export function hasProjectContext(context: ProjectContext): boolean {
	return (
		(context.instructions && context.instructions.trim().length > 0) ||
		context.conversationSummaries.length > 0 ||
		context.relevantChatHistory.length > 0 ||
		context.links.length > 0
	);
}
