/**
 * Streaming metrics state management
 * Tracks tokens/second, time to first token, and other performance metrics during streaming
 */

/** Streaming metrics class with reactive properties */
export class StreamingMetricsState {
	// Core timing state
	isActive = $state(false);
	startTime = $state<number | null>(null);
	firstTokenTime = $state<number | null>(null);
	endTime = $state<number | null>(null);

	// Token tracking
	tokenCount = $state(0);

	// For real-time elapsed updates during streaming
	private tickInterval: ReturnType<typeof setInterval> | null = null;
	currentTime = $state<number>(Date.now());

	// Derived: Time to first token in milliseconds
	ttft = $derived.by(() => {
		if (this.startTime === null || this.firstTokenTime === null) return null;
		return this.firstTokenTime - this.startTime;
	});

	// Derived: Elapsed time in milliseconds (updates during streaming)
	elapsed = $derived.by(() => {
		if (this.startTime === null) return 0;
		const endPoint = this.endTime ?? this.currentTime;
		return endPoint - this.startTime;
	});

	// Derived: Tokens per second (generation speed, not including TTFT)
	tokensPerSecond = $derived.by(() => {
		if (this.tokenCount === 0 || this.firstTokenTime === null) return 0;

		// Calculate from first token onwards (excludes model loading/prompt processing)
		const endPoint = this.endTime ?? this.currentTime;
		const generationTime = endPoint - this.firstTokenTime;

		if (generationTime <= 0) return 0;
		return this.tokenCount / (generationTime / 1000);
	});

	// Derived: Formatted display string
	displayStats = $derived.by(() => {
		if (!this.isActive && this.tokenCount === 0) return null;

		const parts: string[] = [];

		// Tokens per second
		if (this.tokensPerSecond > 0) {
			parts.push(`${this.tokensPerSecond.toFixed(1)} tok/s`);
		}

		// Time to first token
		if (this.ttft !== null) {
			const ttftSeconds = this.ttft / 1000;
			parts.push(`${ttftSeconds.toFixed(2)}s TTFT`);
		}

		// Token count
		if (this.tokenCount > 0) {
			parts.push(`${this.tokenCount} tokens`);
		}

		return parts.length > 0 ? parts.join(' | ') : null;
	});

	/**
	 * Start tracking a new streaming session
	 */
	startStream(): void {
		this.isActive = true;
		this.startTime = Date.now();
		this.firstTokenTime = null;
		this.endTime = null;
		this.tokenCount = 0;
		this.currentTime = Date.now();

		// Start ticking for real-time elapsed updates
		this.startTicking();
	}

	/**
	 * Record when the first token arrives
	 */
	recordFirstToken(): void {
		if (this.firstTokenTime === null) {
			this.firstTokenTime = Date.now();
		}
	}

	/**
	 * Increment the token count
	 * @param count Number of tokens to add (default 1)
	 */
	incrementTokens(count = 1): void {
		// Record first token time on first increment
		if (this.firstTokenTime === null) {
			this.firstTokenTime = Date.now();
		}
		this.tokenCount += count;
	}

	/**
	 * End the streaming session
	 */
	endStream(): void {
		this.isActive = false;
		this.endTime = Date.now();
		this.stopTicking();
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.isActive = false;
		this.startTime = null;
		this.firstTokenTime = null;
		this.endTime = null;
		this.tokenCount = 0;
		this.stopTicking();
	}

	/**
	 * Start the interval for real-time elapsed time updates
	 */
	private startTicking(): void {
		this.stopTicking();
		this.tickInterval = setInterval(() => {
			this.currentTime = Date.now();
		}, 100); // Update every 100ms for smooth display
	}

	/**
	 * Stop the elapsed time update interval
	 */
	private stopTicking(): void {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}
}

/** Singleton streaming metrics instance */
export const streamingMetricsState = new StreamingMetricsState();
