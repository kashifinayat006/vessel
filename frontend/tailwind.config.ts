import { skeleton } from '@skeletonlabs/tw-plugin';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
	darkMode: 'class',
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/@skeletonlabs/skeleton/**/*.{html,js,svelte,ts}'
	],
	theme: {
		extend: {}
	},
	plugins: [
		typography,
		skeleton({
			themes: {
				preset: ['skeleton', 'wintry', 'modern', 'crimson']
			}
		})
	]
} satisfies Config;
