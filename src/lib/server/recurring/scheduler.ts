import { db } from '$lib/server/db/index.js';
import { recurringTaskRules, tasks, columns, taskLabels } from '$lib/server/db/schema.js';
import { eq, and, lte, count } from 'drizzle-orm';
import type { RecurringTaskRule } from '$lib/server/db/schema.js';
import { generateKeyBetween } from '$lib/utils/fractional-index.js';

interface NextOccurrence {
	date: Date;
	isoString: string;
}

/**
 * Parse an RRULE string and calculate the next occurrence after a reference date.
 *
 * Supports: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, BYDAY, BYMONTHDAY, BYMONTH
 */
export function parseRRule(rrule: string, _timezone: string = 'UTC'): NextOccurrence | null {
	const parts = new Map<string, string>();
	for (const part of rrule.split(';')) {
		const [key, value] = part.split('=');
		if (key && value) {
			parts.set(key.trim(), value.trim());
		}
	}

	const freq = parts.get('FREQ');
	if (!freq) return null;

	const interval = parseInt(parts.get('INTERVAL') ?? '1', 10);
	const until = parts.get('UNTIL') ? new Date(parts.get('UNTIL')!) : null;

	const now = new Date();
	const next = new Date(now);

	switch (freq) {
		case 'DAILY':
			next.setDate(next.getDate() + interval);
			break;
		case 'WEEKLY': {
			const byDay = parts.get('BYDAY');
			if (byDay) {
				const dayMap: Record<string, number> = {
					SU: 0,
					MO: 1,
					TU: 2,
					WE: 3,
					TH: 4,
					FR: 5,
					SA: 6
				};
				const targetDays = byDay
					.split(',')
					.map((d) => dayMap[d.trim()])
					.filter((d) => d !== undefined);
				if (targetDays.length > 0) {
					const currentDay = now.getDay();
					// Find next matching day
					let daysUntilNext = Infinity;
					for (const target of targetDays) {
						let diff = target - currentDay;
						if (diff <= 0) diff += 7 * interval;
						if (diff < daysUntilNext) daysUntilNext = diff;
					}
					next.setDate(next.getDate() + daysUntilNext);
				} else {
					next.setDate(next.getDate() + 7 * interval);
				}
			} else {
				next.setDate(next.getDate() + 7 * interval);
			}
			break;
		}
		case 'MONTHLY': {
			const byMonthDay = parts.get('BYMONTHDAY');
			if (byMonthDay) {
				const targetDay = parseInt(byMonthDay, 10);
				next.setMonth(next.getMonth() + interval);
				next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())));
			} else {
				next.setMonth(next.getMonth() + interval);
			}
			break;
		}
		case 'YEARLY':
			next.setFullYear(next.getFullYear() + interval);
			break;
		default:
			return null;
	}

	// Reset time to start of day
	next.setHours(9, 0, 0, 0);

	// Check UNTIL constraint
	if (until && next > until) {
		return null;
	}

	return {
		date: next,
		isoString: next.toISOString()
	};
}

function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

/**
 * Create a new task instance from a recurring rule definition.
 */
export async function generateTaskFromRule(rule: RecurringTaskRule): Promise<{
	taskId: string;
	displayId: string;
} | null> {
	// Verify the target column still exists
	const [col] = await db.select().from(columns).where(eq(columns.id, rule.columnId)).limit(1);

	if (!col) return null;

	// Get next task number for the project
	const [taskCountResult] = await db
		.select({ total: count() })
		.from(tasks)
		.where(eq(tasks.projectId, rule.projectId));

	const taskNumber = (taskCountResult?.total ?? 0) + 1;
	const displayId = `TM-${taskNumber}`;

	// Calculate position for the new task
	const existingTasks = await db
		.select({ position: tasks.position })
		.from(tasks)
		.where(eq(tasks.columnId, rule.columnId))
		.orderBy(tasks.position);

	const lastPosition =
		existingTasks.length > 0 ? existingTasks[existingTasks.length - 1].position : null;

	const position = generateKeyBetween(lastPosition, null);

	const [task] = await db
		.insert(tasks)
		.values({
			displayId,
			projectId: rule.projectId,
			columnId: rule.columnId,
			title: rule.title,
			description: rule.description ?? null,
			priority: rule.priority,
			status: 'todo',
			assigneeId: rule.assigneeId ?? null,
			reporterId: rule.createdBy,
			position,
			storyPoints: rule.storyPoints ?? null,
			estimateMinutes: rule.estimateMinutes ?? null
		})
		.returning();

	// Attach labels if configured
	if (rule.labelIds && rule.labelIds.length > 0) {
		const labelValues = rule.labelIds.map((labelId) => ({
			taskId: task.id,
			labelId
		}));
		await db.insert(taskLabels).values(labelValues);
	}

	return { taskId: task.id, displayId };
}

/**
 * Process all active recurring task rules.
 * Checks each rule whose nextOccurrenceAt is in the past and generates tasks.
 * Returns the number of tasks generated.
 */
export async function processRecurringTasks(): Promise<{
	processed: number;
	generated: number;
	errors: { ruleId: string; error: string }[];
}> {
	const now = new Date().toISOString();

	// Find all active rules that are due
	const dueRules = await db
		.select()
		.from(recurringTaskRules)
		.where(
			and(eq(recurringTaskRules.isActive, true), lte(recurringTaskRules.nextOccurrenceAt, now))
		);

	let generated = 0;
	const errors: { ruleId: string; error: string }[] = [];

	for (const rule of dueRules) {
		try {
			// Check if max occurrences reached
			if (rule.maxOccurrences && rule.occurrenceCount >= rule.maxOccurrences) {
				await db
					.update(recurringTaskRules)
					.set({ isActive: false, updatedAt: now })
					.where(eq(recurringTaskRules.id, rule.id));
				continue;
			}

			// Check if end date passed
			if (rule.endsAt && new Date(rule.endsAt) < new Date()) {
				await db
					.update(recurringTaskRules)
					.set({ isActive: false, updatedAt: now })
					.where(eq(recurringTaskRules.id, rule.id));
				continue;
			}

			// Generate the task
			const result = await generateTaskFromRule(rule);
			if (!result) {
				errors.push({ ruleId: rule.id, error: 'Failed to generate task (column may be deleted)' });
				continue;
			}

			// Calculate next occurrence
			const nextOccurrence = parseRRule(rule.rrule, rule.timezone);

			// Update the rule
			await db
				.update(recurringTaskRules)
				.set({
					lastGeneratedAt: now,
					nextOccurrenceAt: nextOccurrence?.isoString ?? null,
					occurrenceCount: rule.occurrenceCount + 1,
					updatedAt: now,
					// Deactivate if no more occurrences possible
					isActive: nextOccurrence !== null
				})
				.where(eq(recurringTaskRules.id, rule.id));

			generated++;
		} catch (err) {
			errors.push({
				ruleId: rule.id,
				error: err instanceof Error ? err.message : 'Unknown error'
			});
		}
	}

	return { processed: dueRules.length, generated, errors };
}
