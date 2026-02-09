import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { automationRules } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { updateAutomationSchema } from '$lib/validation/automations.js';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;
	const [rule] = await db
		.select()
		.from(automationRules)
		.where(eq(automationRules.id, ruleId))
		.limit(1);

	if (!rule) throw error(404, 'Automation rule not found');

	await requireProjectAccess(event, rule.projectId);
	return json(rule);
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;
	const [existing] = await db
		.select()
		.from(automationRules)
		.where(eq(automationRules.id, ruleId))
		.limit(1);

	if (!existing) throw error(404, 'Automation rule not found');

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = updateAutomationSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const changes = result.data;
	const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

	if (changes.name !== undefined) updateData.name = changes.name;
	if (changes.description !== undefined) updateData.description = changes.description;
	if (changes.trigger !== undefined) updateData.trigger = changes.trigger;
	if (changes.actions !== undefined) updateData.actions = changes.actions;
	if (changes.isActive !== undefined) updateData.isActive = changes.isActive;

	const [updated] = await db
		.update(automationRules)
		.set(updateData)
		.where(eq(automationRules.id, ruleId))
		.returning();

	return json(updated);
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { ruleId } = event.params;
	const [existing] = await db
		.select()
		.from(automationRules)
		.where(eq(automationRules.id, ruleId))
		.limit(1);

	if (!existing) throw error(404, 'Automation rule not found');

	await requireProjectAccess(event, existing.projectId);

	await db.delete(automationRules).where(eq(automationRules.id, ruleId));

	return json({ success: true });
};
