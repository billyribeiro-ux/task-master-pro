import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { goals, goalTaskLinks, tasks } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireProjectAccess, requireAuth } from '$lib/server/auth/guards.js';
import { updateGoalSchema } from '$lib/validation/goals.js';

export const GET: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw error(404, 'Goal not found');

	if (goal.projectId) {
		await requireProjectAccess(event, goal.projectId);
	}

	// Fetch child goals
	const childGoals = await db
		.select()
		.from(goals)
		.where(eq(goals.parentGoalId, goalId));

	// Fetch linked tasks
	const links = await db
		.select()
		.from(goalTaskLinks)
		.where(eq(goalTaskLinks.goalId, goalId));

	const linkedTasks = [];
	for (const link of links) {
		const [task] = await db
			.select()
			.from(tasks)
			.where(eq(tasks.id, link.taskId))
			.limit(1);
		if (task) linkedTasks.push(task);
	}

	return json({
		...goal,
		childGoals,
		linkedTasks
	});
};

export const PATCH: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [existing] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!existing) throw error(404, 'Goal not found');

	if (existing.projectId) {
		await requireProjectAccess(event, existing.projectId);
	}

	const body = await event.request.json();
	const result = updateGoalSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const changes = result.data;
	const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

	if (changes.title !== undefined) updateData.title = changes.title;
	if (changes.description !== undefined) updateData.description = changes.description;
	if (changes.status !== undefined) {
		updateData.status = changes.status;
		if (changes.status === 'completed') {
			updateData.completedAt = new Date().toISOString();
		} else if (existing.status === 'completed') {
			updateData.completedAt = null;
		}
	}
	if (changes.progressCurrent !== undefined) updateData.progressCurrent = changes.progressCurrent;
	if (changes.progressTarget !== undefined) updateData.progressTarget = changes.progressTarget;
	if (changes.unit !== undefined) updateData.unit = changes.unit;
	if (changes.startDate !== undefined) updateData.startDate = changes.startDate;
	if (changes.dueDate !== undefined) updateData.dueDate = changes.dueDate;

	const [updated] = await db
		.update(goals)
		.set(updateData)
		.where(eq(goals.id, goalId))
		.returning();

	return json(updated);
};

export const DELETE: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [existing] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!existing) throw error(404, 'Goal not found');

	if (existing.projectId) {
		await requireProjectAccess(event, existing.projectId);
	}

	await db.delete(goals).where(eq(goals.id, goalId));

	return json({ success: true });
};
