import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { recurringTaskRules, columns, activityLog } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { createRecurringTaskSchema } from '$lib/validation/recurring-tasks.js';
import { parseRRule } from '$lib/server/recurring/scheduler.js';

/**
 * POST /api/v1/recurring-tasks
 * Create a new recurring task rule.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createRecurringTaskSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	await requireProjectAccess(event, data.projectId);

	// Verify the column exists within this project
	const [col] = await db
		.select()
		.from(columns)
		.where(and(eq(columns.id, data.columnId), eq(columns.projectId, data.projectId)))
		.limit(1);

	if (!col) {
		throw error(400, 'Invalid column for this project');
	}

	// Calculate the first occurrence
	const nextOccurrence = parseRRule(data.rrule, data.timezone);
	if (!nextOccurrence) {
		throw error(400, 'Could not calculate next occurrence from the provided RRULE');
	}

	const [rule] = await db
		.insert(recurringTaskRules)
		.values({
			projectId: data.projectId,
			createdBy: event.locals.user.id,
			title: data.title,
			description: data.description ?? null,
			columnId: data.columnId,
			assigneeId: data.assigneeId ?? null,
			priority: data.priority,
			storyPoints: data.storyPoints ?? null,
			estimateMinutes: data.estimateMinutes ?? null,
			labelIds: data.labelIds ?? null,
			rrule: data.rrule,
			timezone: data.timezone,
			nextOccurrenceAt: nextOccurrence.isoString,
			endsAt: data.endsAt ?? null,
			maxOccurrences: data.maxOccurrences ?? null
		})
		.returning();

	await db.insert(activityLog).values({
		projectId: data.projectId,
		actorId: event.locals.user.id,
		action: 'recurring_rule.created',
		metadata: {
			ruleId: rule.id,
			title: rule.title,
			rrule: rule.rrule
		}
	});

	return json(rule, { status: 201 });
};

/**
 * GET /api/v1/recurring-tasks?projectId=xxx
 * List all recurring task rules for a project.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const rules = await db
		.select()
		.from(recurringTaskRules)
		.where(eq(recurringTaskRules.projectId, projectId))
		.orderBy(desc(recurringTaskRules.createdAt));

	return json(rules);
};
