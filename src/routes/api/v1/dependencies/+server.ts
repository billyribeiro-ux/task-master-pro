import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { taskDependencies, tasks, activityLog } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { createDependencySchema } from '$lib/validation/dependencies.js';
import { detectCircularDependency } from '$lib/server/dependencies/graph.js';

/**
 * POST /api/v1/dependencies
 * Create a new task dependency with circular dependency detection.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createDependencySchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;

	// Verify both tasks exist and belong to the same project
	const [task] = await db.select().from(tasks).where(eq(tasks.id, data.taskId)).limit(1);

	if (!task) throw error(404, 'Task not found');

	const [dependsOnTask] = await db
		.select()
		.from(tasks)
		.where(eq(tasks.id, data.dependsOnTaskId))
		.limit(1);

	if (!dependsOnTask) throw error(404, 'Dependency task not found');

	if (task.projectId !== dependsOnTask.projectId) {
		throw error(400, 'Tasks must belong to the same project');
	}

	await requireProjectAccess(event, task.projectId);

	// Check for existing dependency
	const existing = await db
		.select()
		.from(taskDependencies)
		.where(
			and(
				eq(taskDependencies.taskId, data.taskId),
				eq(taskDependencies.dependsOnTaskId, data.dependsOnTaskId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		throw error(409, 'Dependency already exists');
	}

	// Check for circular dependency (only for blocking types)
	if (data.type === 'blocks' || data.type === 'is_blocked_by') {
		const wouldCreateCycle = await detectCircularDependency(
			data.taskId,
			data.dependsOnTaskId,
			task.projectId
		);

		if (wouldCreateCycle) {
			throw error(422, 'Cannot create dependency: this would create a circular dependency chain');
		}
	}

	const [dependency] = await db
		.insert(taskDependencies)
		.values({
			taskId: data.taskId,
			dependsOnTaskId: data.dependsOnTaskId,
			type: data.type,
			createdBy: event.locals.user.id
		})
		.returning();

	await db.insert(activityLog).values({
		projectId: task.projectId,
		taskId: data.taskId,
		actorId: event.locals.user.id,
		action: 'dependency.created',
		metadata: {
			dependencyId: dependency.id,
			dependsOnTaskId: data.dependsOnTaskId,
			type: data.type
		}
	});

	return json(dependency, { status: 201 });
};

/**
 * GET /api/v1/dependencies?taskId=xxx
 * List all dependencies for a given task (both directions).
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const taskId = event.url.searchParams.get('taskId');
	if (!taskId) throw error(400, 'taskId is required');

	// Verify task exists and user has access
	const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	// Get dependencies where this task depends on others
	const dependsOn = await db
		.select()
		.from(taskDependencies)
		.where(eq(taskDependencies.taskId, taskId));

	// Get dependencies where others depend on this task
	const dependedOnBy = await db
		.select()
		.from(taskDependencies)
		.where(eq(taskDependencies.dependsOnTaskId, taskId));

	return json({
		taskId,
		dependsOn,
		dependedOnBy
	});
};
