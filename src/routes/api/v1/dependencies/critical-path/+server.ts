import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { getCriticalPath, getBlockedTasks } from '$lib/server/dependencies/graph.js';

/**
 * GET /api/v1/dependencies/critical-path?projectId=xxx
 * Calculate and return the critical path for a project.
 * Also returns all currently blocked tasks.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const [criticalPath, blockedTasks] = await Promise.all([
		getCriticalPath(projectId),
		getBlockedTasks(projectId)
	]);

	return json({
		criticalPath: criticalPath.path,
		totalEstimateMinutes: criticalPath.totalEstimateMinutes,
		blockedTasks,
		blockedCount: blockedTasks.length
	});
};
