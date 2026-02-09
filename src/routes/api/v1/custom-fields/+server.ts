import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { customFieldDefinitions } from '$lib/server/db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { createCustomFieldSchema } from '$lib/validation/custom-fields.js';

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s_]/g, '')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createCustomFieldSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	await requireProjectAccess(event, data.projectId);

	const slug = generateSlug(data.name);
	if (!slug) {
		throw error(400, 'Name must produce a valid slug');
	}

	// Check for duplicate slug within the project
	const existing = await db
		.select()
		.from(customFieldDefinitions)
		.where(
			and(
				eq(customFieldDefinitions.projectId, data.projectId),
				eq(customFieldDefinitions.slug, slug)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		throw error(409, 'A custom field with this name already exists in the project');
	}

	// Determine position (append to end)
	const [countResult] = await db
		.select({ total: count() })
		.from(customFieldDefinitions)
		.where(eq(customFieldDefinitions.projectId, data.projectId));

	const position = countResult?.total ?? 0;

	const [field] = await db
		.insert(customFieldDefinitions)
		.values({
			projectId: data.projectId,
			name: data.name,
			slug,
			fieldType: data.fieldType,
			description: data.description ?? null,
			isRequired: data.isRequired ?? false,
			options: data.options ?? null,
			defaultValue: data.defaultValue ?? null,
			position
		})
		.returning();

	return json(field, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const fields = await db
		.select()
		.from(customFieldDefinitions)
		.where(eq(customFieldDefinitions.projectId, projectId))
		.orderBy(customFieldDefinitions.position);

	return json(fields);
};
