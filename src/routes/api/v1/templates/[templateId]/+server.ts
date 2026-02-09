import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projectTemplates } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';

export const GET: RequestHandler = async (event) => {
	requireAuth(event);
	const { templateId } = event.params;

	const [template] = await db
		.select()
		.from(projectTemplates)
		.where(eq(projectTemplates.id, templateId))
		.limit(1);

	if (!template) {
		throw error(404, 'Template not found');
	}

	return json(template);
};

export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const { templateId } = event.params;

	const [template] = await db
		.select()
		.from(projectTemplates)
		.where(eq(projectTemplates.id, templateId))
		.limit(1);

	if (!template) {
		throw error(404, 'Template not found');
	}

	// Only the creator or a superadmin can delete a template
	if (template.createdBy !== user.id && user.role !== 'superadmin') {
		throw error(403, 'Forbidden: you can only delete your own templates');
	}

	await db.delete(projectTemplates).where(eq(projectTemplates.id, templateId));

	return json({ success: true });
};
