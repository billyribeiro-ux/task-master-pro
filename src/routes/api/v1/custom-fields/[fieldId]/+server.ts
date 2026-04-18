import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { customFieldDefinitions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { updateCustomFieldSchema } from '$lib/validation/custom-fields.js';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { fieldId } = event.params;
	const [field] = await db
		.select()
		.from(customFieldDefinitions)
		.where(eq(customFieldDefinitions.id, fieldId))
		.limit(1);

	if (!field) throw error(404, 'Custom field not found');

	await requireProjectAccess(event, field.projectId);
	return json(field);
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { fieldId } = event.params;
	const [existing] = await db
		.select()
		.from(customFieldDefinitions)
		.where(eq(customFieldDefinitions.id, fieldId))
		.limit(1);

	if (!existing) throw error(404, 'Custom field not found');

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = updateCustomFieldSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const changes = result.data;
	const updateData: Record<string, unknown> = {};

	if (changes.name !== undefined) updateData.name = changes.name;
	if (changes.description !== undefined) updateData.description = changes.description;
	if (changes.isRequired !== undefined) updateData.isRequired = changes.isRequired;
	if (changes.options !== undefined) updateData.options = changes.options;
	if (changes.defaultValue !== undefined) updateData.defaultValue = changes.defaultValue;
	if (changes.position !== undefined) updateData.position = changes.position;

	if (Object.keys(updateData).length === 0) {
		return json(existing);
	}

	const [updated] = await db
		.update(customFieldDefinitions)
		.set(updateData)
		.where(eq(customFieldDefinitions.id, fieldId))
		.returning();

	return json(updated);
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { fieldId } = event.params;
	const [existing] = await db
		.select()
		.from(customFieldDefinitions)
		.where(eq(customFieldDefinitions.id, fieldId))
		.limit(1);

	if (!existing) throw error(404, 'Custom field not found');

	await requireProjectAccess(event, existing.projectId);

	// Deleting the field definition cascades to delete all values
	await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, fieldId));

	return json({ success: true });
};
