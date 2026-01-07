/**
 * Embeddings service for RAG
 *
 * Generates embeddings using Ollama's /api/embed endpoint
 * and provides vector similarity search capabilities.
 */

import { ollamaClient } from '$lib/ollama';

/** Preferred embedding model */
export const PREFERRED_EMBEDDING_MODEL = 'embeddinggemma:latest';

/** Fallback embedding model */
export const FALLBACK_EMBEDDING_MODEL = 'nomic-embed-text';

/** Default embedding model (prefer embeddinggemma, fallback to nomic) */
export const DEFAULT_EMBEDDING_MODEL = PREFERRED_EMBEDDING_MODEL;

/** Alternative embedding models that Ollama supports */
export const EMBEDDING_MODELS = [
	'embeddinggemma:latest', // Preferred model
	'nomic-embed-text',      // Good general-purpose, 768 dimensions
	'mxbai-embed-large',     // High quality, 1024 dimensions
	'all-minilm',            // Smaller, faster, 384 dimensions
	'snowflake-arctic-embed' // Good for retrieval, 1024 dimensions
] as const;

/**
 * Generate embeddings for a text string
 */
export async function generateEmbedding(
	text: string,
	model: string = DEFAULT_EMBEDDING_MODEL
): Promise<number[]> {
	const TIMEOUT_MS = 30000; // 30 second timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await ollamaClient.embed({
			model,
			input: text
		}, controller.signal);

		// Ollama returns an array of embeddings (one per input)
		// We're only passing one input, so take the first
		return response.embeddings[0];
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Embedding generation timed out. Is the model "${model}" available?`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Generate embeddings for multiple texts in a batch
 */
export async function generateEmbeddings(
	texts: string[],
	model: string = DEFAULT_EMBEDDING_MODEL
): Promise<number[][]> {
	// Process in batches to avoid overwhelming the API
	const BATCH_SIZE = 10;
	const results: number[][] = [];

	// Create abort controller with timeout
	const TIMEOUT_MS = 30000; // 30 second timeout per batch

	for (let i = 0; i < texts.length; i += BATCH_SIZE) {
		const batch = texts.slice(i, i + BATCH_SIZE);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const response = await ollamaClient.embed({
				model,
				input: batch
			}, controller.signal);
			results.push(...response.embeddings);
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Embedding generation timed out. Is the model "${model}" available?`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	return results;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	normA = Math.sqrt(normA);
	normB = Math.sqrt(normB);

	if (normA === 0 || normB === 0) {
		return 0;
	}

	return dotProduct / (normA * normB);
}

/**
 * Find the most similar vectors to a query vector
 */
export function findSimilar<T extends { embedding: number[] }>(
	query: number[],
	candidates: T[],
	topK: number = 5,
	threshold: number = 0.5
): Array<T & { similarity: number }> {
	const scored = candidates
		.map((candidate) => ({
			...candidate,
			similarity: cosineSimilarity(query, candidate.embedding)
		}))
		.filter((item) => item.similarity >= threshold)
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, topK);

	return scored;
}

/**
 * Normalize a vector (convert to unit vector)
 */
export function normalizeVector(vector: number[]): number[] {
	const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
	if (norm === 0) return vector;
	return vector.map((val) => val / norm);
}

/**
 * Calculate the dimension of embeddings for a given model
 * These are approximations - actual dimensions depend on the model
 */
export function getEmbeddingDimension(model: string): number {
	const dimensions: Record<string, number> = {
		'embeddinggemma:latest': 768, // Gemma-based embedding model
		'embeddinggemma': 768,
		'nomic-embed-text': 768,
		'mxbai-embed-large': 1024,
		'all-minilm': 384,
		'snowflake-arctic-embed': 1024
	};

	return dimensions[model] ?? 768; // Default to 768
}
