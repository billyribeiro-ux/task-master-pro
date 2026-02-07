import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { google } from '$lib/server/auth/oauth.js';
import { generateState, generateCodeVerifier } from 'arctic';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

	cookies.set('google_oauth_state', state, {
		path: '/',
		httpOnly: true,
		secure: import.meta.env.PROD,
		maxAge: 60 * 10,
		sameSite: 'lax'
	});

	cookies.set('google_code_verifier', codeVerifier, {
		path: '/',
		httpOnly: true,
		secure: import.meta.env.PROD,
		maxAge: 60 * 10,
		sameSite: 'lax'
	});

	throw redirect(302, url.toString());
};
