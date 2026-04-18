import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { taskDependencies, tasks, activityLog } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';

/**
 * DELETE /api/v1/dependencies/:dependencyId
 * Remove an existing task dependency.
 */
export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { dependencyId } = event.params;

	const [dependency] = await db
		.select()
		.from(taskDependencies)
		.where(eq(taskDependencies.id, dependencyId))
		.limit(1);

	if (!dependency) throw error(404, 'Dependency not found');

	// Verify the user has access to the project owning the task
	const [task] = await db.select().from(tasks).where(eq(tasks.id, dependency.taskId)).limit(1);

	if (!task) throw error(404, 'Associated task not found');

	await requireProjectAccess(event, task.projectId);

	await db.delete(taskDependencies).where(eq(taskDependencies.id, dependencyId));

	await db.insert(activityLog).values({
		projectId: task.projectId,
		taskId: dependency.taskId,
		actorId: event.locals.user.id,
		action: 'dependency.deleted',
		metadata: {
			dependencyId,
			dependsOnTaskId: dependency.dependsOnTaskId,
			type: dependency.type
		}
	});

	return json({ success: true });
};
