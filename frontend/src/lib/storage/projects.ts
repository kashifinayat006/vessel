/**
 * Project CRUD operations for IndexedDB storage
 */

import { db, withErrorHandling, generateId } from './db.js';
import type { StoredProject, StoredProjectLink, StorageResult } from './db.js';

// ============================================================================
// Types
// ============================================================================

export interface Project {
	id: string;
	name: string;
	description: string;
	instructions: string;
	color: string;
	isCollapsed: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ProjectLink {
	id: string;
	projectId: string;
	url: string;
	title: string;
	description: string;
	createdAt: Date;
}

export interface CreateProjectData {
	name: string;
	description?: string;
	instructions?: string;
	color?: string;
}

export interface UpdateProjectData {
	name?: string;
	description?: string;
	instructions?: string;
	color?: string;
	isCollapsed?: boolean;
}

export interface CreateProjectLinkData {
	projectId: string;
	url: string;
	title: string;
	description?: string;
}

// ============================================================================
// Converters
// ============================================================================

function toDomainProject(stored: StoredProject): Project {
	return {
		id: stored.id,
		name: stored.name,
		description: stored.description,
		instructions: stored.instructions,
		color: stored.color,
		isCollapsed: stored.isCollapsed,
		createdAt: new Date(stored.createdAt),
		updatedAt: new Date(stored.updatedAt)
	};
}

function toDomainProjectLink(stored: StoredProjectLink): ProjectLink {
	return {
		id: stored.id,
		projectId: stored.projectId,
		url: stored.url,
		title: stored.title,
		description: stored.description,
		createdAt: new Date(stored.createdAt)
	};
}

// Default project colors (tailwind-inspired)
const PROJECT_COLORS = [
	'#8b5cf6', // violet-500
	'#06b6d4', // cyan-500
	'#10b981', // emerald-500
	'#f59e0b', // amber-500
	'#ef4444', // red-500
	'#ec4899', // pink-500
	'#3b82f6', // blue-500
	'#84cc16'  // lime-500
];

function getRandomColor(): string {
	return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
}

// ============================================================================
// Project CRUD
// ============================================================================

/**
 * Get all projects, sorted by name
 */
export async function getAllProjects(): Promise<StorageResult<Project[]>> {
	return withErrorHandling(async () => {
		const all = await db.projects.toArray();
		const sorted = all.sort((a, b) => a.name.localeCompare(b.name));
		return sorted.map(toDomainProject);
	});
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<StorageResult<Project | null>> {
	return withErrorHandling(async () => {
		const stored = await db.projects.get(id);
		return stored ? toDomainProject(stored) : null;
	});
}

/**
 * Create a new project
 */
export async function createProject(data: CreateProjectData): Promise<StorageResult<Project>> {
	return withErrorHandling(async () => {
		const now = Date.now();
		const stored: StoredProject = {
			id: generateId(),
			name: data.name,
			description: data.description || '',
			instructions: data.instructions || '',
			color: data.color || getRandomColor(),
			isCollapsed: false,
			createdAt: now,
			updatedAt: now
		};

		await db.projects.add(stored);
		return toDomainProject(stored);
	});
}

/**
 * Update an existing project
 */
export async function updateProject(
	id: string,
	updates: UpdateProjectData
): Promise<StorageResult<Project>> {
	return withErrorHandling(async () => {
		const existing = await db.projects.get(id);
		if (!existing) {
			throw new Error(`Project not found: ${id}`);
		}

		const updated: StoredProject = {
			...existing,
			...updates,
			updatedAt: Date.now()
		};

		await db.projects.put(updated);
		return toDomainProject(updated);
	});
}

/**
 * Delete a project and all associated data
 * - Unlinks all conversations (sets projectId to null)
 * - Deletes all project links
 * - Deletes all project documents
 * - Deletes all chat chunks for the project
 */
export async function deleteProject(id: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.transaction('rw', [db.projects, db.projectLinks, db.conversations, db.documents, db.chatChunks], async () => {
			// Unlink all conversations from this project
			const conversations = await db.conversations.where('projectId').equals(id).toArray();
			for (const conv of conversations) {
				await db.conversations.update(conv.id, { projectId: null });
			}

			// Delete all project links
			await db.projectLinks.where('projectId').equals(id).delete();

			// Delete all project documents (and their chunks)
			const documents = await db.documents.where('projectId').equals(id).toArray();
			for (const doc of documents) {
				await db.chunks.where('documentId').equals(doc.id).delete();
			}
			await db.documents.where('projectId').equals(id).delete();

			// Delete all chat chunks for this project
			await db.chatChunks.where('projectId').equals(id).delete();

			// Delete the project itself
			await db.projects.delete(id);
		});
	});
}

/**
 * Toggle project collapse state
 */
export async function toggleProjectCollapse(id: string): Promise<StorageResult<boolean>> {
	return withErrorHandling(async () => {
		const existing = await db.projects.get(id);
		if (!existing) {
			throw new Error(`Project not found: ${id}`);
		}

		const newState = !existing.isCollapsed;
		await db.projects.update(id, { isCollapsed: newState });
		return newState;
	});
}

// ============================================================================
// Project Links CRUD
// ============================================================================

/**
 * Get all links for a project
 */
export async function getProjectLinks(projectId: string): Promise<StorageResult<ProjectLink[]>> {
	return withErrorHandling(async () => {
		const links = await db.projectLinks.where('projectId').equals(projectId).toArray();
		return links.map(toDomainProjectLink);
	});
}

/**
 * Add a link to a project
 */
export async function addProjectLink(data: CreateProjectLinkData): Promise<StorageResult<ProjectLink>> {
	return withErrorHandling(async () => {
		const stored: StoredProjectLink = {
			id: generateId(),
			projectId: data.projectId,
			url: data.url,
			title: data.title,
			description: data.description || '',
			createdAt: Date.now()
		};

		await db.projectLinks.add(stored);
		return toDomainProjectLink(stored);
	});
}

/**
 * Update a project link
 */
export async function updateProjectLink(
	id: string,
	updates: Partial<Pick<ProjectLink, 'url' | 'title' | 'description'>>
): Promise<StorageResult<ProjectLink>> {
	return withErrorHandling(async () => {
		const existing = await db.projectLinks.get(id);
		if (!existing) {
			throw new Error(`Project link not found: ${id}`);
		}

		const updated: StoredProjectLink = {
			...existing,
			...updates
		};

		await db.projectLinks.put(updated);
		return toDomainProjectLink(updated);
	});
}

/**
 * Delete a project link
 */
export async function deleteProjectLink(id: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.projectLinks.delete(id);
	});
}

// ============================================================================
// Project Statistics
// ============================================================================

/**
 * Get statistics for a project
 */
export async function getProjectStats(projectId: string): Promise<StorageResult<{
	conversationCount: number;
	documentCount: number;
	linkCount: number;
}>> {
	return withErrorHandling(async () => {
		const [conversations, documents, links] = await Promise.all([
			db.conversations.where('projectId').equals(projectId).count(),
			db.documents.where('projectId').equals(projectId).count(),
			db.projectLinks.where('projectId').equals(projectId).count()
		]);

		return {
			conversationCount: conversations,
			documentCount: documents,
			linkCount: links
		};
	});
}
