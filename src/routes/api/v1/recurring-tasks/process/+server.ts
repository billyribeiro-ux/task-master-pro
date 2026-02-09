import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { processRecurringTasks } from '$lib/server/recurring/scheduler.js';

/**
 * POST /api/v1/recurring-tasks/process
 * Trigger processing of all due recurring task rules.
 * Intended to be called by a cron job or scheduler.
 *
 * Requires authentication. In production, this could be secured
 * with an API key or restricted to admin roles.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const result = await processRecurringTasks();

	return json({
		success: true,
		processed: result.processed,
		generated: result.generated,
		errors: result.errors
	});
};
