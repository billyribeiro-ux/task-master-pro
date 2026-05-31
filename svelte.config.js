import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	kit: {
		adapter: adapter(),
		// Nonce/hash-based CSP managed by SvelteKit. This removes the need for
		// `unsafe-inline` on script-src — SvelteKit injects a per-response nonce
		// into its own inline scripts. `style-src` keeps `unsafe-inline` because
		// inline `style=` attributes (e.g. dynamic column colours) are not covered
		// by CSP nonces.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'connect-src': ['self', 'ws:', 'wss:'],
				'font-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		},
		experimental: {
			remoteFunctions: true
		}
	}
};

export default config;
