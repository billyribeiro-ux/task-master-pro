import type { LayoutServerLoad } from './$types.js';
import { requireAuth } from '$lib/server/auth/guards.js';
import { db } from '$lib/server/db/index.js';
import { notifications } from '$lib/server/db/schema.js';
import { eq, and, count } from 'drizzle-orm';

export const load: LayoutServerLoad = async (event) => {
	const user = requireAuth(event);

	const [unreadResult] = await db
		.select({ total: count() })
		.from(notifications)
		.where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

	return {
		user,
		unreadNotifications: unreadResult?.total ?? 0
	};
};
