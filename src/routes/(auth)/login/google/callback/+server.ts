import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { google } from '$lib/server/auth/oauth.js';
import { db } from '$lib/server/db/index.js';
import { users, oauthAccounts } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
	createSession,
	generateSessionToken,
	createSessionCookie
} from '$lib/server/auth/index.js';

interface GoogleUser {
	sub: string;
	name: string;
	email: string;
	email_verified: boolean;
	picture: string;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('google_oauth_state');
	const codeVerifier = cookies.get('google_code_verifier');

	if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
		throw error(400, 'Invalid OAuth state');
	}

	cookies.delete('google_oauth_state', { path: '/' });
	cookies.delete('google_code_verifier', { path: '/' });

	let tokens;
	try {
		tokens = await google.validateAuthorizationCode(code, codeVerifier);
	} catch {
		throw error(400, 'Failed to validate authorization code');
	}

	const accessToken = tokens.accessToken();

	const googleUserResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	const googleUser: GoogleUser = await googleUserResponse.json();

	if (!googleUser.email) {
		throw error(400, 'Could not retrieve email from Google');
	}

	const existingOAuth = await db
		.select()
		.from(oauthAccounts)
		.where(
			and(
				eq(oauthAccounts.providerId, 'google'),
				eq(oauthAccounts.providerUserId, googleUser.sub)
			)
		)
		.limit(1);

	let userId: string;

	if (existingOAuth.length > 0) {
		userId = existingOAuth[0].userId;

		await db
			.update(users)
			.set({
				avatarUrl: googleUser.picture,
				name: googleUser.name,
				updatedAt: new Date().toISOString()
			})
			.where(eq(users.id, userId));
	} else {
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, googleUser.email.toLowerCase()))
			.limit(1);

		if (existingUser.length > 0) {
			userId = existingUser[0].id;
		} else {
			const [newUser] = await db
				.insert(users)
				.values({
					email: googleUser.email.toLowerCase(),
					name: googleUser.name,
					avatarUrl: googleUser.picture
				})
				.returning();
			userId = newUser.id;
		}

		await db.insert(oauthAccounts).values({
			providerId: 'google',
			providerUserId: googleUser.sub,
			userId
		});
	}

	const token = generateSessionToken();
	await createSession(token, userId);
	const cookie = createSessionCookie(token);

	cookies.set(cookie.name, cookie.value, {
		path: cookie.attributes.path as string,
		httpOnly: cookie.attributes.httpOnly as boolean,
		sameSite: cookie.attributes.sameSite as 'lax',
		secure: cookie.attributes.secure as boolean,
		maxAge: cookie.attributes.maxAge as number
	});

	throw redirect(303, '/dashboard');
};
