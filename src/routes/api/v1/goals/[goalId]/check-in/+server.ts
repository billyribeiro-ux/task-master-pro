import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { goals, goalCheckIns } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireProjectAccess, requireAuth } from '$lib/server/auth/guards.js';
import { createCheckInSchema } from '$lib/validation/goals.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const { goalId } = event.params;
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw error(404, 'Goal not found');

	if (goal.projectId) {
		await requireProjectAccess(event, goal.projectId);
	}

	const body = await event.request.json();
	const result = createCheckInSchema.safeParse({ ...body, goalId });
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	const previousValue = goal.progressCurrent;

	// Create the check-in record
	const [checkIn] = await db
		.insert(goalCheckIns)
		.values({
			goalId,
			authorId: user.id,
			previousValue,
			newValue: data.newValue,
			note: data.note ?? null
		})
		.returning();

	// Update the goal's current progress
	await db
		.update(goals)
		.set({
			progressCurrent: data.newValue,
			updatedAt: new Date().toISOString()
		})
		.where(eq(goals.id, goalId));

	return json(checkIn, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	requireAuth(event);

	const { goalId } = event.params;
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw error(404, 'Goal not found');

	if (goal.projectId) {
		await requireProjectAccess(event, goal.projectId);
	}

	const checkIns = await db
		.select()
		.from(goalCheckIns)
		.where(eq(goalCheckIns.goalId, goalId))
		.orderBy(desc(goalCheckIns.createdAt));

	return json(checkIns);
};
