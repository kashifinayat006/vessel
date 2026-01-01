/**
 * UI state management using Svelte 5 runes
 * Handles sidenav, theme, and responsive state
 */

/** Breakpoint for mobile detection (in pixels) */
const MOBILE_BREAKPOINT = 768;

/** UI state class with reactive properties */
export class UIState {
	// Core state
	sidenavOpen = $state(true);
	darkMode = $state(true); // Default to dark mode
	isMobile = $state(false);

	// Bound function references for proper cleanup
	private boundHandleResize: () => void;
	private boundHandleThemeChange: (e: MediaQueryListEvent) => void;
	private mediaQuery: MediaQueryList | null = null;

	// Derived: Effective sidenav state (closed on mobile by default)
	effectiveSidenavOpen = $derived.by(() => {
		if (this.isMobile) {
			return this.sidenavOpen;
		}
		return this.sidenavOpen;
	});

	constructor() {
		// Bind handlers once for proper add/remove
		this.boundHandleResize = this.handleResize.bind(this);
		this.boundHandleThemeChange = this.handleThemeChange.bind(this);
	}

	/**
	 * Initialize UI state (call in browser only)
	 * Sets up media queries and loads persisted preferences
	 */
	initialize(): void {
		if (typeof window === 'undefined') return;

		// Check initial mobile state
		this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;

		// Default sidenav closed on mobile
		if (this.isMobile) {
			this.sidenavOpen = false;
		}

		// Load dark mode preference (default to dark if not set)
		const savedDarkMode = localStorage.getItem('darkMode');
		if (savedDarkMode !== null) {
			this.darkMode = savedDarkMode === 'true';
		}
		// If no preference saved, keep default (dark mode)

		// Apply dark mode class
		this.applyDarkMode();

		// Listen for resize events
		window.addEventListener('resize', this.boundHandleResize);

		// Listen for system theme changes
		this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		this.mediaQuery.addEventListener('change', this.boundHandleThemeChange);
	}

	/**
	 * Clean up event listeners
	 */
	destroy(): void {
		if (typeof window === 'undefined') return;
		window.removeEventListener('resize', this.boundHandleResize);
		this.mediaQuery?.removeEventListener('change', this.boundHandleThemeChange);
		this.mediaQuery = null;
	}

	/**
	 * Handle window resize
	 */
	private handleResize(): void {
		const wasMobile = this.isMobile;
		this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;

		// Auto-close sidenav when switching to mobile
		if (!wasMobile && this.isMobile) {
			this.sidenavOpen = false;
		}
	}

	/**
	 * Handle system theme preference changes
	 */
	private handleThemeChange(e: MediaQueryListEvent): void {
		// Only apply if user hasn't set explicit preference
		if (localStorage.getItem('darkMode') === null) {
			this.darkMode = e.matches;
			this.applyDarkMode();
		}
	}

	/**
	 * Apply dark mode class to document
	 */
	private applyDarkMode(): void {
		if (typeof document === 'undefined') return;

		if (this.darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	/**
	 * Toggle sidenav open/closed
	 */
	toggleSidenav(): void {
		this.sidenavOpen = !this.sidenavOpen;
	}

	/**
	 * Open sidenav
	 */
	openSidenav(): void {
		this.sidenavOpen = true;
	}

	/**
	 * Close sidenav
	 */
	closeSidenav(): void {
		this.sidenavOpen = false;
	}

	/**
	 * Toggle dark mode
	 */
	toggleDarkMode(): void {
		this.darkMode = !this.darkMode;
		this.applyDarkMode();

		// Persist preference
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('darkMode', String(this.darkMode));
		}
	}

	/**
	 * Set dark mode explicitly
	 * @param enabled Whether dark mode should be enabled
	 */
	setDarkMode(enabled: boolean): void {
		this.darkMode = enabled;
		this.applyDarkMode();

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('darkMode', String(this.darkMode));
		}
	}

	/**
	 * Reset to system preference for dark mode
	 */
	useSystemTheme(): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('darkMode');
		}

		if (typeof window !== 'undefined') {
			this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			this.applyDarkMode();
		}
	}
}

/** Singleton UI state instance */
export const uiState = new UIState();
