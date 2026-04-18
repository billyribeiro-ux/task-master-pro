import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projectTemplates } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { createTemplateSchema } from '$lib/validation/templates.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = createTemplateSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;

	const [template] = await db
		.insert(projectTemplates)
		.values({
			createdBy: user.id,
			name: data.name,
			description: data.description ?? null,
			category: data.category,
			isPublic: data.isPublic,
			templateData: data.templateData
		})
		.returning();

	return json(template, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const category = event.url.searchParams.get('category');
	const isPublicParam = event.url.searchParams.get('isPublic');

	const conditions: ReturnType<typeof eq>[] = [];

	if (category) {
		conditions.push(
			eq(
				projectTemplates.category,
				category as
					| 'engineering'
					| 'marketing'
					| 'design'
					| 'operations'
					| 'sales'
					| 'hr'
					| 'custom'
			)
		);
	}

	if (isPublicParam !== null) {
		const isPublic = isPublicParam === 'true';
		conditions.push(eq(projectTemplates.isPublic, isPublic));
	}

	// If no public filter specified, show user's own templates + public templates
	if (isPublicParam === null) {
		// Fetch user's own templates and public templates separately
		const ownTemplates = await db
			.select()
			.from(projectTemplates)
			.where(
				conditions.length > 0
					? and(eq(projectTemplates.createdBy, user.id), ...conditions)
					: eq(projectTemplates.createdBy, user.id)
			)
			.orderBy(desc(projectTemplates.createdAt));

		const publicTemplates = await db
			.select()
			.from(projectTemplates)
			.where(
				conditions.length > 0
					? and(eq(projectTemplates.isPublic, true), ...conditions)
					: eq(projectTemplates.isPublic, true)
			)
			.orderBy(desc(projectTemplates.createdAt));

		// Merge and deduplicate (own templates may also be public)
		const seen = new Set<string>();
		const merged = [];

		for (const t of ownTemplates) {
			if (!seen.has(t.id)) {
				seen.add(t.id);
				merged.push(t);
			}
		}
		for (const t of publicTemplates) {
			if (!seen.has(t.id)) {
				seen.add(t.id);
				merged.push(t);
			}
		}

		return json(merged);
	}

	// If explicit filter is set, apply conditions
	const templates = await db
		.select()
		.from(projectTemplates)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(projectTemplates.createdAt));

	return json(templates);
};
