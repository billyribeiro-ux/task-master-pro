import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { github } from '$lib/server/auth/oauth.js';
import { generateState } from 'arctic';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const url = github.createAuthorizationURL(state, ['user:email']);

	cookies.set('github_oauth_state', state, {
		path: '/',
		httpOnly: true,
		secure: import.meta.env.PROD,
		maxAge: 60 * 10,
		sameSite: 'lax'
	});

	throw redirect(302, url.toString());
};
