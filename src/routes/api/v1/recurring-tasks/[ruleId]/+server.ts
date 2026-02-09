import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { recurringTaskRules, columns, activityLog } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { updateRecurringTaskSchema } from '$lib/validation/recurring-tasks.js';
import { parseRRule } from '$lib/server/recurring/scheduler.js';

/**
 * GET /api/v1/recurring-tasks/:ruleId
 * Get a single recurring task rule by ID.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;

	const [rule] = await db
		.select()
		.from(recurringTaskRules)
		.where(eq(recurringTaskRules.id, ruleId))
		.limit(1);

	if (!rule) throw error(404, 'Recurring task rule not found');

	await requireProjectAccess(event, rule.projectId);

	return json(rule);
};

/**
 * PATCH /api/v1/recurring-tasks/:ruleId
 * Update an existing recurring task rule.
 */
export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;

	const [existing] = await db
		.select()
		.from(recurringTaskRules)
		.where(eq(recurringTaskRules.id, ruleId))
		.limit(1);

	if (!existing) throw error(404, 'Recurring task rule not found');

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = updateRecurringTaskSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const changes = result.data;
	const updateData: Record<string, unknown> = {
		updatedAt: new Date().toISOString()
	};

	if (changes.title !== undefined) updateData.title = changes.title;
	if (changes.description !== undefined) updateData.description = changes.description;
	if (changes.assigneeId !== undefined) updateData.assigneeId = changes.assigneeId;
	if (changes.priority !== undefined) updateData.priority = changes.priority;
	if (changes.storyPoints !== undefined) updateData.storyPoints = changes.storyPoints;
	if (changes.estimateMinutes !== undefined) updateData.estimateMinutes = changes.estimateMinutes;
	if (changes.labelIds !== undefined) updateData.labelIds = changes.labelIds;
	if (changes.isActive !== undefined) updateData.isActive = changes.isActive;
	if (changes.endsAt !== undefined) updateData.endsAt = changes.endsAt;
	if (changes.maxOccurrences !== undefined) updateData.maxOccurrences = changes.maxOccurrences;
	if (changes.timezone !== undefined) updateData.timezone = changes.timezone;

	// If column is being changed, validate it belongs to the same project
	if (changes.columnId !== undefined) {
		const [col] = await db
			.select()
			.from(columns)
			.where(
				and(
					eq(columns.id, changes.columnId),
					eq(columns.projectId, existing.projectId)
				)
			)
			.limit(1);

		if (!col) {
			throw error(400, 'Invalid column for this project');
		}
		updateData.columnId = changes.columnId;
	}

	// If RRULE is being changed, recalculate next occurrence
	if (changes.rrule !== undefined) {
		updateData.rrule = changes.rrule;
		const tz = changes.timezone ?? existing.timezone;
		const nextOccurrence = parseRRule(changes.rrule, tz);
		if (!nextOccurrence) {
			throw error(400, 'Could not calculate next occurrence from the provided RRULE');
		}
		updateData.nextOccurrenceAt = nextOccurrence.isoString;
	}

	const [updated] = await db
		.update(recurringTaskRules)
		.set(updateData)
		.where(eq(recurringTaskRules.id, ruleId))
		.returning();

	await db.insert(activityLog).values({
		projectId: existing.projectId,
		actorId: event.locals.user.id,
		action: 'recurring_rule.updated',
		metadata: {
			ruleId,
			changes: Object.keys(changes)
		}
	});

	return json(updated);
};

/**
 * DELETE /api/v1/recurring-tasks/:ruleId
 * Delete a recurring task rule. Does not delete tasks already generated.
 */
export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;

	const [existing] = await db
		.select()
		.from(recurringTaskRules)
		.where(eq(recurringTaskRules.id, ruleId))
		.limit(1);

	if (!existing) throw error(404, 'Recurring task rule not found');

	await requireProjectAccess(event, existing.projectId);

	await db.delete(recurringTaskRules).where(eq(recurringTaskRules.id, ruleId));

	await db.insert(activityLog).values({
		projectId: existing.projectId,
		actorId: event.locals.user.id,
		action: 'recurring_rule.deleted',
		metadata: {
			ruleId,
			title: existing.title
		}
	});

	return json({ success: true });
};
