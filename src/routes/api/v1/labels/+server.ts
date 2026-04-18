import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { labels } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess } from '$lib/server/auth/guards.js';

const createLabelSchema = z.object({
	projectId: z.string().min(1),
	name: z.string().min(1).max(50),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createLabelSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	await requireProjectAccess(event, result.data.projectId);

	const [label] = await db
		.insert(labels)
		.values({
			projectId: result.data.projectId,
			name: result.data.name,
			color: result.data.color
		})
		.returning();

	return json(label, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const projectLabels = await db.select().from(labels).where(eq(labels.projectId, projectId));

	return json(projectLabels);
};
