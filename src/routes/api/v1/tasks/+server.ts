import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { client } from '$lib/server/db/index.js';
import { tasks, activityLog, columns, projectCounters } from '$lib/server/db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { checkFeatureLimit } from '$lib/server/payments/guards.js';
import { generateKeyBetween } from '$lib/utils/fractional-index.js';

const createTaskSchema = z.object({
	projectId: z.string().min(1),
	columnId: z.string().min(1),
	title: z.string().min(1).max(500),
	description: z.string().optional(),
	priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
	assigneeId: z.string().optional(),
	dueDate: z.string().optional(),
	storyPoints: z.number().int().min(0).optional(),
	estimateMinutes: z.number().int().min(0).optional()
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createTaskSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	await requireProjectAccess(event, data.projectId);

	// Check plan limits before creating task
	const planCheck = await checkFeatureLimit(event.locals.user.id, 'tasks');
	if (!planCheck.allowed) {
		throw error(403, `Plan limit reached: maximum ${planCheck.limit} tasks allowed on your current plan`);
	}

	const col = await db
		.select()
		.from(columns)
		.where(and(eq(columns.id, data.columnId), eq(columns.projectId, data.projectId)))
		.limit(1);

	if (col.length === 0) {
		throw error(400, 'Invalid column');
	}

	// Atomic counter increment for race-safe displayId generation
	// Use upsert: insert counter if not exists, then increment atomically
	await db.insert(projectCounters)
		.values({ projectId: data.projectId, taskCounter: 0 })
		.onConflictDoNothing();

	const counterResult = await client.execute({
		sql: 'UPDATE project_counters SET task_counter = task_counter + 1 WHERE project_id = ? RETURNING task_counter',
		args: [data.projectId]
	});

	const taskNumber = Number(counterResult.rows[0].task_counter);
	const displayId = `TM-${taskNumber}`;

	const existingTasks = await db
		.select({ position: tasks.position })
		.from(tasks)
		.where(eq(tasks.columnId, data.columnId))
		.orderBy(tasks.position);

	const lastPosition = existingTasks.length > 0
		? existingTasks[existingTasks.length - 1].position
		: null;

	const position = generateKeyBetween(lastPosition, null);

	const [task] = await db
		.insert(tasks)
		.values({
			displayId,
			projectId: data.projectId,
			columnId: data.columnId,
			title: data.title,
			description: data.description ?? null,
			priority: data.priority ?? 'none',
			status: 'todo',
			assigneeId: data.assigneeId ?? null,
			reporterId: event.locals.user.id,
			position,
			dueDate: data.dueDate ?? null,
			storyPoints: data.storyPoints ?? null,
			estimateMinutes: data.estimateMinutes ?? null
		})
		.returning();

	await db.insert(activityLog).values({
		projectId: data.projectId,
		taskId: task.id,
		actorId: event.locals.user.id,
		action: 'task.created',
		metadata: { title: task.title, displayId: task.displayId }
	});

	return json(task, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const limit = Math.min(Number(event.url.searchParams.get('limit')) || 50, 100);
	const cursor = event.url.searchParams.get('cursor');

	const projectTasks = await db
		.select()
		.from(tasks)
		.where(
			cursor
				? and(eq(tasks.projectId, projectId), gt(tasks.id, cursor))
				: eq(tasks.projectId, projectId)
		)
		.orderBy(tasks.position)
		.limit(limit + 1);

	const hasMore = projectTasks.length > limit;
	if (hasMore) projectTasks.pop();

	return json({
		data: projectTasks,
		nextCursor: hasMore ? projectTasks[projectTasks.length - 1]?.id : null
	});
};
