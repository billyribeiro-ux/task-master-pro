import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { timeEntries, tasks } from '$lib/server/db/schema.js';
import { eq, and, desc, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess } from '$lib/server/auth/guards.js';

const createTimeEntrySchema = z.object({
	taskId: z.string().min(1),
	note: z.string().max(500).optional()
});

const stopTimeEntrySchema = z.object({
	id: z.string().min(1)
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createTimeEntrySchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { taskId, note } = result.data;

	const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	const [entry] = await db.transaction(async (tx) => {
		const running = await tx
			.select()
			.from(timeEntries)
			.where(
				and(
					eq(timeEntries.taskId, taskId),
					eq(timeEntries.userId, event.locals.user!.id),
					isNull(timeEntries.stoppedAt)
				)
			)
			.limit(1);

		if (running.length > 0) {
			throw error(409, 'Timer already running for this task');
		}

		return tx
			.insert(timeEntries)
			.values({
				taskId,
				userId: event.locals.user!.id,
				startedAt: new Date().toISOString(),
				note: note ?? null
			})
			.returning();
	});

	return json(entry, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = stopTimeEntrySchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const [entry] = await db
		.select()
		.from(timeEntries)
		.where(and(eq(timeEntries.id, result.data.id), eq(timeEntries.userId, event.locals.user.id)))
		.limit(1);

	if (!entry) throw error(404, 'Time entry not found');
	if (entry.stoppedAt) throw error(400, 'Timer already stopped');

	const stoppedAt = new Date().toISOString();
	const startedAt = new Date(entry.startedAt);
	const durationSeconds = Math.floor((new Date(stoppedAt).getTime() - startedAt.getTime()) / 1000);

	const [updated] = await db
		.update(timeEntries)
		.set({ stoppedAt, durationSeconds })
		.where(eq(timeEntries.id, entry.id))
		.returning();

	return json(updated);
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const taskId = event.url.searchParams.get('taskId');
	const limit = Math.min(Number(event.url.searchParams.get('limit')) || 50, 100);
	const cursor = event.url.searchParams.get('cursor');

	const baseConditions = taskId
		? and(eq(timeEntries.taskId, taskId), eq(timeEntries.userId, event.locals.user.id))
		: eq(timeEntries.userId, event.locals.user.id);

	const entries = await db
		.select()
		.from(timeEntries)
		.where(cursor ? and(baseConditions, lt(timeEntries.id, cursor)) : baseConditions)
		.orderBy(desc(timeEntries.startedAt))
		.limit(limit + 1);

	const hasMore = entries.length > limit;
	if (hasMore) entries.pop();

	return json({
		data: entries,
		nextCursor: hasMore ? entries[entries.length - 1]?.id : null
	});
};
