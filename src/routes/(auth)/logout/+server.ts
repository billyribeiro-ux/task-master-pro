import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { invalidateSession, createBlankSessionCookie } from '$lib/server/auth/index.js';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.session) {
		await invalidateSession(locals.session.id);
	}

	const cookie = createBlankSessionCookie();
	cookies.set(cookie.name, cookie.value, {
		path: cookie.attributes.path as string,
		httpOnly: cookie.attributes.httpOnly as boolean,
		sameSite: cookie.attributes.sameSite as 'lax',
		secure: cookie.attributes.secure as boolean,
		maxAge: cookie.attributes.maxAge as number
	});

	throw redirect(303, '/login');
};
