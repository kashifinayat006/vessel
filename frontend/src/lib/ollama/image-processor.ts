/**
 * Image processing utilities for Ollama vision models
 * Handles resizing, compression, and base64 encoding
 */

/** Maximum dimensions for vision models (LLaVA limit) */
const MAX_WIDTH = 1344;
const MAX_HEIGHT = 1344;

/** Maximum file size after processing (10MB) */
const MAX_PROCESSED_SIZE = 10 * 1024 * 1024;

/** JPEG compression quality */
const JPEG_QUALITY = 0.85;

/** Supported image MIME types */
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Result of image processing */
export interface ProcessedImage {
	/** Base64 encoded image data (without data: prefix) */
	base64: string;
	/** Original filename */
	filename: string;
	/** Original file size in bytes */
	originalSize: number;
	/** Processed file size in bytes */
	processedSize: number;
	/** Original dimensions */
	originalDimensions: { width: number; height: number };
	/** Processed dimensions */
	processedDimensions: { width: number; height: number };
}

/** Error thrown when image processing fails */
export class ImageProcessingError extends Error {
	constructor(
		message: string,
		public readonly code: 'INVALID_TYPE' | 'TOO_LARGE' | 'PROCESSING_FAILED' | 'LOAD_FAILED'
	) {
		super(message);
		this.name = 'ImageProcessingError';
	}
}

/**
 * Validate that the file is a supported image type
 */
export function isValidImageType(file: File): boolean {
	return SUPPORTED_TYPES.includes(file.type);
}

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new ImageProcessingError('Failed to load image', 'LOAD_FAILED'));
		};

		img.src = url;
	});
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
	width: number,
	height: number,
	maxWidth: number,
	maxHeight: number
): { width: number; height: number } {
	if (width <= maxWidth && height <= maxHeight) {
		return { width, height };
	}

	const aspectRatio = width / height;

	if (width > height) {
		// Landscape orientation
		const newWidth = Math.min(width, maxWidth);
		const newHeight = Math.round(newWidth / aspectRatio);

		if (newHeight > maxHeight) {
			return {
				width: Math.round(maxHeight * aspectRatio),
				height: maxHeight
			};
		}

		return { width: newWidth, height: newHeight };
	} else {
		// Portrait or square orientation
		const newHeight = Math.min(height, maxHeight);
		const newWidth = Math.round(newHeight * aspectRatio);

		if (newWidth > maxWidth) {
			return {
				width: maxWidth,
				height: Math.round(maxWidth / aspectRatio)
			};
		}

		return { width: newWidth, height: newHeight };
	}
}

/**
 * Convert canvas to base64 without data: prefix
 */
function canvasToBase64(canvas: HTMLCanvasElement): string {
	const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
	// Remove the "data:image/jpeg;base64," prefix
	const prefixIndex = dataUrl.indexOf(',');
	return dataUrl.substring(prefixIndex + 1);
}

/**
 * Calculate the size of a base64 string in bytes
 */
function getBase64Size(base64: string): number {
	// Base64 encoding adds ~33% overhead, so decoded size is ~75% of encoded
	const padding = (base64.match(/=/g) || []).length;
	return (base64.length * 3) / 4 - padding;
}

/**
 * Process an image file for Ollama vision models
 *
 * Resizes to fit within MAX_WIDTH x MAX_HEIGHT,
 * compresses to JPEG at JPEG_QUALITY,
 * and returns base64 without data: prefix (Ollama requirement)
 *
 * @param file - The image file to process
 * @returns Processed image data with base64 and metadata
 * @throws ImageProcessingError if processing fails
 */
export async function processImageForOllama(file: File): Promise<ProcessedImage> {
	// Validate file type
	if (!isValidImageType(file)) {
		throw new ImageProcessingError(
			`Unsupported image type: ${file.type}. Supported types: JPEG, PNG, GIF, WebP`,
			'INVALID_TYPE'
		);
	}

	// Load the image
	const img = await loadImage(file);

	const originalDimensions = { width: img.width, height: img.height };

	// Calculate new dimensions
	const newDimensions = calculateDimensions(img.width, img.height, MAX_WIDTH, MAX_HEIGHT);

	// Create canvas for resizing
	const canvas = document.createElement('canvas');
	canvas.width = newDimensions.width;
	canvas.height = newDimensions.height;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new ImageProcessingError('Failed to get canvas context', 'PROCESSING_FAILED');
	}

	// Use high-quality image smoothing
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';

	// Draw the resized image
	ctx.drawImage(img, 0, 0, newDimensions.width, newDimensions.height);

	// Convert to base64
	const base64 = canvasToBase64(canvas);
	const processedSize = getBase64Size(base64);

	// Validate processed size
	if (processedSize > MAX_PROCESSED_SIZE) {
		throw new ImageProcessingError(
			`Processed image too large: ${(processedSize / 1024 / 1024).toFixed(2)}MB. Maximum: ${MAX_PROCESSED_SIZE / 1024 / 1024}MB`,
			'TOO_LARGE'
		);
	}

	return {
		base64,
		filename: file.name,
		originalSize: file.size,
		processedSize,
		originalDimensions,
		processedDimensions: newDimensions
	};
}

/**
 * Process multiple image files for Ollama
 * Returns an array of base64 strings (without data: prefix)
 *
 * @param files - Array of image files to process
 * @returns Array of base64 encoded images
 */
export async function processImagesForOllama(files: File[]): Promise<string[]> {
	const results = await Promise.all(files.map(processImageForOllama));
	return results.map((r) => r.base64);
}

/**
 * Create a data URL from a base64 string (for display purposes)
 */
export function base64ToDataUrl(base64: string): string {
	if (base64.startsWith('data:')) {
		return base64;
	}
	return `data:image/jpeg;base64,${base64}`;
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
