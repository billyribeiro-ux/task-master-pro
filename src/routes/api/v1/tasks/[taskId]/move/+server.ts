import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tasks, activityLog, columns } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess } from '$lib/server/auth/guards.js';

const moveTaskSchema = z.object({
	columnId: z.string().min(1),
	position: z.string().min(1)
});

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { taskId } = event.params;
	const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

	if (!existing) throw error(404, 'Task not found');

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = moveTaskSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { columnId, position } = result.data;

	const [col] = await db
		.select()
		.from(columns)
		.where(and(eq(columns.id, columnId), eq(columns.projectId, existing.projectId)))
		.limit(1);

	if (!col) throw error(400, 'Invalid column');

	const oldColumnId = existing.columnId;

	const [updated] = await db
		.update(tasks)
		.set({
			columnId,
			position,
			updatedAt: new Date().toISOString()
		})
		.where(eq(tasks.id, taskId))
		.returning();

	await db.insert(activityLog).values({
		projectId: existing.projectId,
		taskId,
		actorId: event.locals.user.id,
		action: 'task.moved',
		metadata: {
			fromColumnId: oldColumnId,
			toColumnId: columnId,
			displayId: existing.displayId
		}
	});

	return json(updated);
};
