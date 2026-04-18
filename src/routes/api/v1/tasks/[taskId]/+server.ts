import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tasks, activityLog } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess, requireProjectRole } from '$lib/server/auth/guards.js';

const updateTaskSchema = z.object({
	title: z.string().min(1).max(500).optional(),
	description: z.string().nullable().optional(),
	priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
	status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
	assigneeId: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	storyPoints: z.number().int().min(0).nullable().optional(),
	estimateMinutes: z.number().int().min(0).nullable().optional(),
	columnId: z.string().optional()
});

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { taskId } = event.params;
	const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);
	return json(task);
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { taskId } = event.params;
	const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

	if (!existing) throw error(404, 'Task not found');

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = updateTaskSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const changes = result.data;
	const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

	if (changes.title !== undefined) updateData.title = changes.title;
	if (changes.description !== undefined) updateData.description = changes.description;
	if (changes.priority !== undefined) updateData.priority = changes.priority;
	if (changes.status !== undefined) {
		updateData.status = changes.status;
		if (changes.status === 'done') {
			updateData.completedAt = new Date().toISOString();
		} else if (existing.status === 'done') {
			updateData.completedAt = null;
		}
	}
	if (changes.assigneeId !== undefined) updateData.assigneeId = changes.assigneeId;
	if (changes.dueDate !== undefined) updateData.dueDate = changes.dueDate;
	if (changes.storyPoints !== undefined) updateData.storyPoints = changes.storyPoints;
	if (changes.estimateMinutes !== undefined) updateData.estimateMinutes = changes.estimateMinutes;
	if (changes.columnId !== undefined) updateData.columnId = changes.columnId;

	const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, taskId)).returning();

	await db.insert(activityLog).values({
		projectId: existing.projectId,
		taskId,
		actorId: event.locals.user.id,
		action: 'task.updated',
		metadata: { changes: Object.keys(changes) }
	});

	return json(updated);
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { taskId } = event.params;
	const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

	if (!existing) throw error(404, 'Task not found');

	await requireProjectRole(event, existing.projectId, ['member', 'admin', 'owner']);

	await db.delete(tasks).where(eq(tasks.id, taskId));

	await db.insert(activityLog).values({
		projectId: existing.projectId,
		taskId,
		actorId: event.locals.user.id,
		action: 'task.deleted',
		metadata: { title: existing.title, displayId: existing.displayId }
	});

	return json({ success: true });
};
