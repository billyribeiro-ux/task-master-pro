import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { registerSchema } from '$lib/validation/auth.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import {
	hashPassword,
	createSession,
	generateSessionToken,
	createSessionCookie
} from '$lib/server/auth/index.js';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const raw = {
			name: formData.get('name') as string,
			email: formData.get('email') as string,
			password: formData.get('password') as string,
			confirmPassword: formData.get('confirmPassword') as string
		};

		const result = registerSchema.safeParse(raw);
		if (!result.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const field = issue.path[0] as string;
				fieldErrors[field] = issue.message;
			}
			return fail(400, { error: null, errors: fieldErrors });
		}

		const { name, email, password } = result.data;

		const existing = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (existing.length > 0) {
			return fail(400, {
				error: 'Unable to create account. Please try again or use a different email.',
				errors: null
			});
		}

		const passwordHash = await hashPassword(password);

		const [user] = await db
			.insert(users)
			.values({
				name,
				email: email.toLowerCase(),
				passwordHash
			})
			.returning();

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
