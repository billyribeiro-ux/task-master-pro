import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { github } from '$lib/server/auth/oauth.js';
import { db } from '$lib/server/db/index.js';
import { users, oauthAccounts } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
	createSession,
	generateSessionToken,
	createSessionCookie
} from '$lib/server/auth/index.js';

interface GitHubUser {
	id: number;
	login: string;
	name: string | null;
	email: string | null;
	avatar_url: string;
}

interface GitHubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('github_oauth_state');

	if (!code || !state || !storedState || state !== storedState) {
		throw error(400, 'Invalid OAuth state');
	}

	cookies.delete('github_oauth_state', { path: '/' });

	let tokens;
	try {
		tokens = await github.validateAuthorizationCode(code);
	} catch {
		throw error(400, 'Failed to validate authorization code');
	}

	const accessToken = tokens.accessToken();

	const githubUserResponse = await fetch('https://api.github.com/user', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	const githubUser: GitHubUser = await githubUserResponse.json();

	let userEmail = githubUser.email;
	if (!userEmail) {
		const emailsResponse = await fetch('https://api.github.com/user/emails', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		const emails: GitHubEmail[] = await emailsResponse.json();
		const primary = emails.find((e) => e.primary && e.verified);
		userEmail = primary?.email ?? emails[0]?.email ?? null;
	}

	if (!userEmail) {
		throw error(400, 'Could not retrieve email from GitHub');
	}

	const existingOAuth = await db
		.select()
		.from(oauthAccounts)
		.where(
			and(
				eq(oauthAccounts.providerId, 'github'),
				eq(oauthAccounts.providerUserId, String(githubUser.id))
			)
		)
		.limit(1);

	let userId: string;

	if (existingOAuth.length > 0) {
		userId = existingOAuth[0].userId;

		await db
			.update(users)
			.set({
				avatarUrl: githubUser.avatar_url,
				name: githubUser.name ?? githubUser.login,
				updatedAt: new Date().toISOString()
			})
			.where(eq(users.id, userId));
	} else {
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, userEmail.toLowerCase()))
			.limit(1);

		if (existingUser.length > 0) {
			userId = existingUser[0].id;
		} else {
			const [newUser] = await db
				.insert(users)
				.values({
					email: userEmail.toLowerCase(),
					name: githubUser.name ?? githubUser.login,
					avatarUrl: githubUser.avatar_url
				})
				.returning();
			userId = newUser.id;
		}

		await db.insert(oauthAccounts).values({
			providerId: 'github',
			providerUserId: String(githubUser.id),
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
