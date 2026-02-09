import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { customFieldValues, customFieldDefinitions, tasks } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { setCustomFieldValueSchema } from '$lib/validation/custom-fields.js';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = setCustomFieldValueSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;

	// Verify task exists and get projectId
	const [task] = await db
		.select()
		.from(tasks)
		.where(eq(tasks.id, data.taskId))
		.limit(1);

	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	// Verify field exists and belongs to the same project
	const [field] = await db
		.select()
		.from(customFieldDefinitions)
		.where(
			and(
				eq(customFieldDefinitions.id, data.fieldId),
				eq(customFieldDefinitions.projectId, task.projectId)
			)
		)
		.limit(1);

	if (!field) throw error(404, 'Custom field not found in this project');

	// Upsert: check if a value already exists for this task+field
	const [existingValue] = await db
		.select()
		.from(customFieldValues)
		.where(
			and(
				eq(customFieldValues.taskId, data.taskId),
				eq(customFieldValues.fieldId, data.fieldId)
			)
		)
		.limit(1);

	const valueData = {
		value: data.value ?? null,
		numericValue: data.numericValue ?? null,
		dateValue: data.dateValue ?? null,
		updatedAt: new Date().toISOString()
	};

	if (existingValue) {
		const [updated] = await db
			.update(customFieldValues)
			.set(valueData)
			.where(eq(customFieldValues.id, existingValue.id))
			.returning();

		return json(updated);
	}

	const [created] = await db
		.insert(customFieldValues)
		.values({
			taskId: data.taskId,
			fieldId: data.fieldId,
			...valueData
		})
		.returning();

	return json(created, { status: 201 });
};

export const PUT: RequestHandler = POST;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const taskId = event.url.searchParams.get('taskId');
	if (!taskId) throw error(400, 'taskId is required');

	// Verify task exists and check access
	const [task] = await db
		.select()
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.limit(1);

	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	const values = await db
		.select()
		.from(customFieldValues)
		.where(eq(customFieldValues.taskId, taskId));

	return json(values);
};
