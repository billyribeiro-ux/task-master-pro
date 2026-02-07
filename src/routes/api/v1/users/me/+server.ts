import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateProfileSchema = z.object({
	name: z.string().min(2).max(100).optional()
});

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json();
	const result = updateProfileSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	if (result.data.name) updates.name = result.data.name;

	const [updated] = await db
		.update(users)
		.set(updates)
		.where(eq(users.id, locals.user.id))
		.returning({ id: users.id, name: users.name, email: users.email });

	return json(updated);
};

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const [user] = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			avatarUrl: users.avatarUrl,
			role: users.role,
			plan: users.plan,
			createdAt: users.createdAt
		})
		.from(users)
		.where(eq(users.id, locals.user.id))
		.limit(1);

	if (!user) throw error(404, 'User not found');

	return json(user);
};
