import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notifications } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { notificationId } = params;

	await db
		.update(notifications)
		.set({ isRead: true })
		.where(and(eq(notifications.id, notificationId), eq(notifications.userId, locals.user.id)));

	return json({ success: true });
};
