import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Use environment variable or default to localhost (works with host network mode)
const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:9090';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 7842,
		proxy: {
			// Backend health check
			'/health': {
				target: backendUrl,
				changeOrigin: true
			},
			// Go backend API (must be before /api to match first)
			'/api/v1': {
				target: backendUrl,
				changeOrigin: true
			},
			// Ollama API
			'/api': {
				target: ollamaUrl,
				changeOrigin: true
			}
		}
	}
});
