import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { loginSchema } from '$lib/validation/auth.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import {
	verifyPassword,
	createSession,
	generateSessionToken,
	createSessionCookie
} from '$lib/server/auth/index.js';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const raw = {
			email: formData.get('email') as string,
			password: formData.get('password') as string
		};

		const result = loginSchema.safeParse(raw);
		if (!result.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const field = issue.path[0] as string;
				fieldErrors[field] = issue.message;
			}
			return fail(400, { error: null, errors: fieldErrors });
		}

		const { email, password } = result.data;

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (!user || !user.passwordHash) {
			return fail(400, {
				error: 'Invalid email or password',
				errors: null
			});
		}

		const validPassword = await verifyPassword(user.passwordHash, password);
		if (!validPassword) {
			return fail(400, {
				error: 'Invalid email or password',
				errors: null
			});
		}

		const token = generateSessionToken();
		await createSession(token, user.id);
		const cookie = createSessionCookie(token);

		cookies.set(cookie.name, cookie.value, {
			path: cookie.attributes.path as string,
			httpOnly: cookie.attributes.httpOnly as boolean,
			sameSite: cookie.attributes.sameSite as 'lax',
			secure: cookie.attributes.secure as boolean,
			maxAge: cookie.attributes.maxAge as number
		});

		throw redirect(303, '/dashboard');
	}
};
