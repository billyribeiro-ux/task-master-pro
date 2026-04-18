import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tasks, columns, activityLog, labels, taskLabels, users } from '$lib/server/db/schema.js';
import { eq, count } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { aiNaturalLanguageTaskSchema } from '$lib/validation/ai.js';
import { parseNaturalLanguageTask } from '$lib/server/ai/engine.js';
import { generateKeyBetween } from '$lib/utils/fractional-index.js';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = aiNaturalLanguageTaskSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { projectId, input, autoCreate } = result.data;
	await requireProjectAccess(event, projectId);

	let parsed;
	try {
		parsed = await parseNaturalLanguageTask(projectId, input);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to parse natural language input';
		throw error(500, message);
	}

	// Resolve the assignee name to a user ID if provided
	let assigneeId: string | null = null;
	if (parsed.assigneeName) {
		const [matchedUser] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.name, parsed.assigneeName))
			.limit(1);
		assigneeId = matchedUser?.id ?? null;
	}

	// If autoCreate is false, just return the parsed data
	if (!autoCreate) {
		return json({
			parsed: {
				...parsed,
				assigneeId
			},
			created: false
		});
	}

	// Auto-create the task
	// Get the first column of the project as the default
	const projectColumns = await db
		.select()
		.from(columns)
		.where(eq(columns.projectId, projectId))
		.orderBy(columns.position)
		.limit(1);

	if (projectColumns.length === 0) {
		throw error(400, 'Project has no columns. Create a column first.');
	}

	const targetColumnId = projectColumns[0].id;

	// Generate display ID
	const [taskCountResult] = await db
		.select({ total: count() })
		.from(tasks)
		.where(eq(tasks.projectId, projectId));

	const taskNumber = (taskCountResult?.total ?? 0) + 1;
	const displayId = `TM-${taskNumber}`;

	// Calculate position
	const existingTasks = await db
		.select({ position: tasks.position })
		.from(tasks)
		.where(eq(tasks.columnId, targetColumnId))
		.orderBy(tasks.position);

	const lastPosition =
		existingTasks.length > 0 ? existingTasks[existingTasks.length - 1].position : null;
	const position = generateKeyBetween(lastPosition, null);

	const [task] = await db
		.insert(tasks)
		.values({
			displayId,
			projectId,
			columnId: targetColumnId,
			title: parsed.title,
			description: parsed.description,
			priority: parsed.priority,
			status: 'todo',
			assigneeId,
			reporterId: event.locals.user.id,
			position,
			dueDate: parsed.dueDate,
			storyPoints: parsed.storyPoints,
			estimateMinutes: parsed.estimateMinutes
		})
		.returning();

	// Attach labels if any were parsed
	if (parsed.labels.length > 0) {
		const projectLabels = await db.select().from(labels).where(eq(labels.projectId, projectId));

		const matchedLabels = projectLabels.filter((l) =>
			parsed.labels.some((pl) => pl.toLowerCase() === l.name.toLowerCase())
		);

		if (matchedLabels.length > 0) {
			await db.insert(taskLabels).values(
				matchedLabels.map((l) => ({
					taskId: task.id,
					labelId: l.id
				}))
			);
		}
	}

	await db.insert(activityLog).values({
		projectId,
		taskId: task.id,
		actorId: event.locals.user.id,
		action: 'task.created',
		metadata: {
			title: task.title,
			displayId: task.displayId,
			source: 'ai_natural_language',
			originalInput: input
		}
	});

	return json(
		{
			parsed: {
				...parsed,
				assigneeId
			},
			created: true,
			task
		},
		{ status: 201 }
	);
};
