import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { automationRules, automationExecutionLog } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;

	const [rule] = await db
		.select()
		.from(automationRules)
		.where(eq(automationRules.id, ruleId))
		.limit(1);

	if (!rule) throw error(404, 'Automation rule not found');

	await requireProjectAccess(event, rule.projectId);

	const limit = Math.min(parseInt(event.url.searchParams.get('limit') ?? '50', 10), 100);
	const offset = parseInt(event.url.searchParams.get('offset') ?? '0', 10);
	const status = event.url.searchParams.get('status');

	const conditions = [eq(automationExecutionLog.ruleId, ruleId)];
	if (status && ['success', 'partial_failure', 'failure'].includes(status)) {
		conditions.push(
			eq(automationExecutionLog.status, status as 'success' | 'partial_failure' | 'failure')
		);
	}

	const logs = await db
		.select()
		.from(automationExecutionLog)
		.where(and(...conditions))
		.orderBy(desc(automationExecutionLog.executedAt))
		.limit(limit)
		.offset(offset);

	return json({ data: logs, limit, offset });
};
