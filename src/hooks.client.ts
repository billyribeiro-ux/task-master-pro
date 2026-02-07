import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();

	if (import.meta.env.DEV) {
		console.error(`[${errorId}] Client error:`, error);
		console.error(`  Status: ${status}`);
		console.error(`  Message: ${message}`);
		console.error(`  URL: ${event.url.pathname}`);
	}

	return {
		message: message || 'An unexpected error occurred',
		code: errorId
	};
};
