/**
 * Project Context Service
 * Builds full project context for chat messages including:
 * - Project instructions
 * - Conversation summaries from other project chats
 * - RAG search across project chat history
 * - Project reference links
 */

import { db, type StoredDocument } from '$lib/storage/db.js';
import {
	getProjectConversationSummaries,
	getConversationsForProject
} from '$lib/storage/conversations.js';
import type { ProjectLink } from '$lib/storage/projects.js';
import { getProjectLinks } from '$lib/storage/projects.js';
import { listDocuments, getDocumentChunks } from '$lib/memory/vector-store.js';
import { searchChatHistory } from './chat-indexer.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationSummary {
	id: string;
	title: string;
	summary: string;
	updatedAt: Date;
}

/** Basic info about a project conversation */
export interface ProjectConversation {
	id: string;
	title: string;
	messageCount: number;
	updatedAt: Date;
	hasSummary: boolean;
	summary?: string;
}

export interface ChatHistoryResult {
	conversationId: string;
	conversationTitle: string;
	content: string;
	similarity: number;
}

/** Document info for context (simplified from StoredDocument) */
export interface ProjectDocument {
	id: string;
	name: string;
	chunkCount: number;
	embeddingStatus: 'pending' | 'processing' | 'ready' | 'failed' | undefined;
	/** Preview of the document content (first chunk, truncated) */
	preview?: string;
}

export interface ProjectContext {
	/** Project instructions to inject into system prompt */
	instructions: string | null;
	/** All other conversations in the project (with summary status) */
	otherConversations: ProjectConversation[];
	/** Relevant snippets from chat history RAG search */
	relevantChatHistory: ChatHistoryResult[];
	/** Reference links for the project */
	links: ProjectLink[];
	/** Documents in the project's knowledge base */
	documents: ProjectDocument[];
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
	const [project, conversationsResult, summariesResult, linksResult, chatHistory, allDocuments] =
		await Promise.all([
			db.projects.get(projectId),
			getConversationsForProject(projectId),
			getProjectConversationSummaries(projectId, currentConversationId),
			getProjectLinks(projectId),
			searchProjectChatHistory(projectId, userQuery, currentConversationId, 3),
			listDocuments()
		]);

	const allConversations = conversationsResult.success ? conversationsResult.data : [];
	const summaries = summariesResult.success ? summariesResult.data : [];
	const links = linksResult.success ? linksResult.data : [];

	// Create a map of summaries by conversation ID for quick lookup
	const summaryMap = new Map(summaries.map((s) => [s.id, s.summary]));

	// Build list of other conversations (excluding current)
	const otherConversations: ProjectConversation[] = allConversations
		.filter((c) => c.id !== currentConversationId)
		.map((c) => ({
			id: c.id,
			title: c.title,
			messageCount: c.messageCount,
			updatedAt: c.updatedAt,
			hasSummary: summaryMap.has(c.id),
			summary: summaryMap.get(c.id)
		}));


	// Filter documents for this project that are ready
	const readyDocs = allDocuments.filter(
		(d) => d.projectId === projectId && d.embeddingStatus === 'ready'
	);

	// Fetch previews for each document (first chunk, truncated)
	const projectDocuments: ProjectDocument[] = await Promise.all(
		readyDocs.map(async (d) => {
			let preview: string | undefined;
			try {
				const chunks = await getDocumentChunks(d.id);
				if (chunks.length > 0) {
					// Get first chunk, truncate to ~500 chars
					const firstChunk = chunks[0].content;
					preview =
						firstChunk.length > 500 ? firstChunk.slice(0, 500) + '...' : firstChunk;
				}
			} catch {
				// Ignore errors fetching chunks
			}
			return {
				id: d.id,
				name: d.name,
				chunkCount: d.chunkCount,
				embeddingStatus: d.embeddingStatus,
				preview
			};
		})
	);

	return {
		instructions: project?.instructions || null,
		otherConversations,
		relevantChatHistory: chatHistory,
		links,
		documents: projectDocuments
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
	topK: number = 10,
	threshold: number = 0.2
): Promise<ChatHistoryResult[]> {
	const results = await searchChatHistory(
		projectId,
		query,
		excludeConversationId,
		topK,
		threshold
	);

	return results.map((r) => ({
		conversationId: r.conversationId,
		conversationTitle: r.conversationTitle,
		content: r.content,
		similarity: r.similarity
	}));
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

	// Project knowledge base documents with previews
	if (context.documents.length > 0) {
		const docsText = context.documents
			.map((d) => {
				let entry = `### ${d.name}\n`;
				if (d.preview) {
					entry += `${d.preview}\n`;
				} else {
					entry += `(${d.chunkCount} chunks available)\n`;
				}
				return entry;
			})
			.join('\n');
		parts.push(
			`## Project Knowledge Base\nThe following documents are available. Use this content to answer questions about the project:\n\n${docsText}`
		);
	}

	// Other conversations in this project
	if (context.otherConversations.length > 0) {
		const conversationsText = context.otherConversations
			.slice(0, 10) // Limit to 10 most recent
			.map((c) => {
				if (c.hasSummary && c.summary) {
					return `- **${c.title}**: ${c.summary}`;
				} else {
					return `- **${c.title}** (${c.messageCount} messages, no summary yet)`;
				}
			})
			.join('\n');
		parts.push(`## Other Chats in This Project\n${conversationsText}`);
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
		context.documents.length > 0 ||
		context.otherConversations.length > 0 ||
		context.relevantChatHistory.length > 0 ||
		context.links.length > 0
	);
}
