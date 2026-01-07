/**
 * Projects state management using Svelte 5 runes
 * Handles project list, selection, and CRUD operations
 */

import type { Project, ProjectLink } from '$lib/storage/projects.js';
import * as projectStorage from '$lib/storage/projects.js';

// Re-export types for convenience
export type { Project, ProjectLink };

/** Projects state class with reactive properties */
export class ProjectsState {
	// Core state
	projects = $state<Project[]>([]);
	activeProjectId = $state<string | null>(null);
	isLoading = $state(false);
	hasLoaded = $state(false); // True after first successful load
	error = $state<string | null>(null);

	// Derived: Active project
	activeProject = $derived.by(() => {
		if (!this.activeProjectId) return null;
		return this.projects.find((p) => p.id === this.activeProjectId) ?? null;
	});

	// Derived: Projects sorted by name
	sortedProjects = $derived.by(() => {
		return [...this.projects].sort((a, b) => a.name.localeCompare(b.name));
	});

	// Derived: Collapsed project IDs for quick lookup
	collapsedIds = $derived.by(() => {
		return new Set(this.projects.filter((p) => p.isCollapsed).map((p) => p.id));
	});

	/**
	 * Load all projects from storage
	 */
	async load(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			const result = await projectStorage.getAllProjects();
			if (result.success) {
				this.projects = result.data;
				this.hasLoaded = true;
			} else {
				this.error = result.error;
				console.error('[ProjectsState] Failed to load projects:', result.error);
			}
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Create a new project
	 */
	async add(data: projectStorage.CreateProjectData): Promise<Project | null> {
		this.error = null;

		const result = await projectStorage.createProject(data);
		if (result.success) {
			this.projects = [...this.projects, result.data];
			return result.data;
		} else {
			this.error = result.error;
			console.error('[ProjectsState] Failed to create project:', result.error);
			return null;
		}
	}

	/**
	 * Update an existing project
	 */
	async update(id: string, updates: projectStorage.UpdateProjectData): Promise<boolean> {
		this.error = null;

		const result = await projectStorage.updateProject(id, updates);
		if (result.success) {
			this.projects = this.projects.map((p) =>
				p.id === id ? result.data : p
			);
			return true;
		} else {
			this.error = result.error;
			console.error('[ProjectsState] Failed to update project:', result.error);
			return false;
		}
	}

	/**
	 * Delete a project
	 */
	async remove(id: string): Promise<boolean> {
		this.error = null;

		const result = await projectStorage.deleteProject(id);
		if (result.success) {
			this.projects = this.projects.filter((p) => p.id !== id);
			// Clear active project if it was deleted
			if (this.activeProjectId === id) {
				this.activeProjectId = null;
			}
			return true;
		} else {
			this.error = result.error;
			console.error('[ProjectsState] Failed to delete project:', result.error);
			return false;
		}
	}

	/**
	 * Toggle project collapse state
	 */
	async toggleCollapse(id: string): Promise<void> {
		const result = await projectStorage.toggleProjectCollapse(id);
		if (result.success) {
			this.projects = this.projects.map((p) =>
				p.id === id ? { ...p, isCollapsed: result.data } : p
			);
		}
	}

	/**
	 * Set the active project (for filtering)
	 */
	setActive(id: string | null): void {
		this.activeProjectId = id;
	}

	/**
	 * Find a project by ID
	 */
	find(id: string): Project | undefined {
		return this.projects.find((p) => p.id === id);
	}

	/**
	 * Check if a project is collapsed
	 */
	isCollapsed(id: string): boolean {
		return this.collapsedIds.has(id);
	}
}

/** Singleton projects state instance */
export const projectsState = new ProjectsState();
