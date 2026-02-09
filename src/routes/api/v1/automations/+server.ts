import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { automationRules } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { createAutomationSchema } from '$lib/validation/automations.js';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const rules = await db
		.select()
		.from(automationRules)
		.where(eq(automationRules.projectId, projectId))
		.orderBy(desc(automationRules.createdAt));

	return json(rules);
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = createAutomationSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	await requireProjectAccess(event, data.projectId);

	const [rule] = await db
		.insert(automationRules)
		.values({
			projectId: data.projectId,
			createdBy: event.locals.user.id,
			name: data.name,
			description: data.description ?? null,
			trigger: data.trigger,
			actions: data.actions
		})
		.returning();

	return json(rule, { status: 201 });
};
