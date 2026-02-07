import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notifications } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const userNotifications = await db
		.select()
		.from(notifications)
		.where(eq(notifications.userId, user.id))
		.orderBy(desc(notifications.createdAt))
		.limit(50);

	return { notifications: userNotifications };
};
