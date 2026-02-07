import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { timeEntries } from '$lib/server/db/schema.js';
import { eq, and, desc, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const [runningEntry] = await db
		.select()
		.from(timeEntries)
		.where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.stoppedAt)))
		.limit(1);

	const recentEntries = await db
		.select()
		.from(timeEntries)
		.where(eq(timeEntries.userId, user.id))
		.orderBy(desc(timeEntries.startedAt))
		.limit(50);

	return {
		runningEntry: runningEntry ?? null,
		recentEntries
	};
};
