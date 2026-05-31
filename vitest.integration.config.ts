import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

// Integration tests exercise server modules against real(ish) dependencies
// (DB, Redis) and run in a Node environment. They live alongside source as
// `*.integration.test.ts` so unit runs (jsdom) and integration runs stay separate.
export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.integration.{test,spec}.{js,ts}'],
		environment: 'node',
		globals: true,
		setupFiles: [],
		testTimeout: 20_000
	}
});
