import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { goals } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireProjectAccess, requireAuth } from '$lib/server/auth/guards.js';
import { createGoalSchema } from '$lib/validation/goals.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = createGoalSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;

	if (data.projectId) {
		await requireProjectAccess(event, data.projectId);
	}

	// If parentGoalId is set, verify the parent exists
	if (data.parentGoalId) {
		const [parent] = await db.select().from(goals).where(eq(goals.id, data.parentGoalId)).limit(1);

		if (!parent) throw error(404, 'Parent goal not found');
	}

	const [goal] = await db
		.insert(goals)
		.values({
			projectId: data.projectId ?? null,
			ownerId: user.id,
			parentGoalId: data.parentGoalId ?? null,
			title: data.title,
			description: data.description ?? null,
			type: data.type,
			progressType: data.progressType ?? 'manual',
			progressTarget: data.progressTarget ?? 100,
			unit: data.unit ?? '%',
			startDate: data.startDate ?? null,
			dueDate: data.dueDate ?? null
		})
		.returning();

	return json(goal, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	requireAuth(event);

	const projectId = event.url.searchParams.get('projectId');
	const type = event.url.searchParams.get('type');

	const conditions = [];

	if (projectId) {
		await requireProjectAccess(event, projectId);
		conditions.push(eq(goals.projectId, projectId));
	}

	if (type) {
		const validTypes = ['objective', 'key_result', 'initiative'] as const;
		if (!validTypes.includes(type as (typeof validTypes)[number])) {
			throw error(400, 'Invalid type filter. Must be: objective, key_result, or initiative');
		}
		conditions.push(eq(goals.type, type as (typeof validTypes)[number]));
	}

	let query;
	if (conditions.length === 0) {
		query = db.select().from(goals).orderBy(desc(goals.createdAt));
	} else if (conditions.length === 1) {
		query = db.select().from(goals).where(conditions[0]).orderBy(desc(goals.createdAt));
	} else {
		query = db
			.select()
			.from(goals)
			.where(and(...conditions))
			.orderBy(desc(goals.createdAt));
	}

	const goalsList = await query;
	return json(goalsList);
};
