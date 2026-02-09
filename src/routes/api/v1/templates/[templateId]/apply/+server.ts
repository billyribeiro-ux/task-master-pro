import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projectTemplates } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { applyTemplateSchema } from '$lib/validation/templates.js';
import { instantiateTemplate } from '$lib/server/templates/instantiate.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const { templateId } = event.params;

	const body = await event.request.json();
	const result = applyTemplateSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;

	// Verify the template exists
	const [template] = await db
		.select()
		.from(projectTemplates)
		.where(eq(projectTemplates.id, templateId))
		.limit(1);

	if (!template) {
		throw error(404, 'Template not found');
	}

	// Check access: public templates are available to all, private only to creator
	if (!template.isPublic && template.createdBy !== user.id && user.role !== 'superadmin') {
		throw error(403, 'Forbidden: this template is not public');
	}

	try {
		const project = await instantiateTemplate(
			templateId,
			user.id,
			data.projectName,
			data.projectDescription
		);

		return json(
			{
				message: 'Project created from template successfully',
				project
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to instantiate template';
		throw error(500, message);
	}
};
