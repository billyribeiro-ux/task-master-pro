import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { comments, tasks, activityLog } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess } from '$lib/server/auth/guards.js';

const createCommentSchema = z.object({
	taskId: z.string().min(1),
	body: z.string().min(1).max(10000)
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createCommentSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { taskId, body: commentBody } = result.data;

	const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	const [comment] = await db
		.insert(comments)
		.values({
			taskId,
			authorId: event.locals.user.id,
			body: commentBody
		})
		.returning();

	await db.insert(activityLog).values({
		projectId: task.projectId,
		taskId,
		actorId: event.locals.user.id,
		action: 'comment.created',
		metadata: { commentId: comment.id }
	});

	return json(comment, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const taskId = event.url.searchParams.get('taskId');
	if (!taskId) throw error(400, 'taskId is required');

	const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	const taskComments = await db
		.select()
		.from(comments)
		.where(eq(comments.taskId, taskId))
		.orderBy(desc(comments.createdAt));

	return json(taskComments);
};
