import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { goals, goalTaskLinks, tasks } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireProjectAccess, requireAuth } from '$lib/server/auth/guards.js';
import { linkTaskToGoalSchema } from '$lib/validation/goals.js';

export const POST: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw error(404, 'Goal not found');

	if (goal.projectId) {
		await requireProjectAccess(event, goal.projectId);
	}

	const body = await event.request.json();
	const result = linkTaskToGoalSchema.safeParse({ ...body, goalId });
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;

	// Verify task exists
	const [task] = await db.select().from(tasks).where(eq(tasks.id, data.taskId)).limit(1);

	if (!task) throw error(404, 'Task not found');

	// Check if already linked
	const [existingLink] = await db
		.select()
		.from(goalTaskLinks)
		.where(and(eq(goalTaskLinks.goalId, goalId), eq(goalTaskLinks.taskId, data.taskId)))
		.limit(1);

	if (existingLink) {
		throw error(409, 'Task is already linked to this goal');
	}

	await db.insert(goalTaskLinks).values({
		goalId,
		taskId: data.taskId
	});

	return json({ goalId, taskId: data.taskId }, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw error(404, 'Goal not found');

	if (goal.projectId) {
		await requireProjectAccess(event, goal.projectId);
	}

	const taskId = event.url.searchParams.get('taskId');
	if (!taskId) throw error(400, 'taskId query parameter is required');

	const [existingLink] = await db
		.select()
		.from(goalTaskLinks)
		.where(and(eq(goalTaskLinks.goalId, goalId), eq(goalTaskLinks.taskId, taskId)))
		.limit(1);

	if (!existingLink) {
		throw error(404, 'Task link not found');
	}

	await db
		.delete(goalTaskLinks)
		.where(and(eq(goalTaskLinks.goalId, goalId), eq(goalTaskLinks.taskId, taskId)));

	return json({ success: true });
};

export const GET: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw error(404, 'Goal not found');

	if (goal.projectId) {
		await requireProjectAccess(event, goal.projectId);
	}

	const links = await db.select().from(goalTaskLinks).where(eq(goalTaskLinks.goalId, goalId));

	const linkedTasks = [];
	for (const link of links) {
		const [task] = await db.select().from(tasks).where(eq(tasks.id, link.taskId)).limit(1);
		if (task) linkedTasks.push(task);
	}

	return json(linkedTasks);
};
