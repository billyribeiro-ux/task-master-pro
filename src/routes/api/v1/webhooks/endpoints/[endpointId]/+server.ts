import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { webhookEndpoints } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireProjectAccess } from '$lib/server/auth/guards.js';
import { updateWebhookSchema } from '$lib/validation/webhooks.js';

export const GET: RequestHandler = async (event) => {
	requireAuth(event);
	const { endpointId } = event.params;

	const [endpoint] = await db
		.select()
		.from(webhookEndpoints)
		.where(eq(webhookEndpoints.id, endpointId))
		.limit(1);

	if (!endpoint) {
		throw error(404, 'Webhook endpoint not found');
	}

	await requireProjectAccess(event, endpoint.projectId);

	return json({
		id: endpoint.id,
		projectId: endpoint.projectId,
		url: endpoint.url,
		events: endpoint.events,
		isActive: endpoint.isActive,
		failureCount: endpoint.failureCount,
		lastTriggeredAt: endpoint.lastTriggeredAt,
		createdAt: endpoint.createdAt
	});
};

export const PATCH: RequestHandler = async (event) => {
	requireAuth(event);
	const { endpointId } = event.params;

	const [existing] = await db
		.select()
		.from(webhookEndpoints)
		.where(eq(webhookEndpoints.id, endpointId))
		.limit(1);

	if (!existing) {
		throw error(404, 'Webhook endpoint not found');
	}

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = updateWebhookSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const changes = result.data;
	const updateData: Record<string, unknown> = {};

	if (changes.url !== undefined) updateData.url = changes.url;
	if (changes.events !== undefined) updateData.events = changes.events;
	if (changes.isActive !== undefined) updateData.isActive = changes.isActive;

	const [updated] = await db
		.update(webhookEndpoints)
		.set(updateData)
		.where(eq(webhookEndpoints.id, endpointId))
		.returning();

	return json({
		id: updated.id,
		projectId: updated.projectId,
		url: updated.url,
		events: updated.events,
		isActive: updated.isActive,
		failureCount: updated.failureCount,
		lastTriggeredAt: updated.lastTriggeredAt,
		createdAt: updated.createdAt
	});
};

export const DELETE: RequestHandler = async (event) => {
	requireAuth(event);
	const { endpointId } = event.params;

	const [existing] = await db
		.select()
		.from(webhookEndpoints)
		.where(eq(webhookEndpoints.id, endpointId))
		.limit(1);

	if (!existing) {
		throw error(404, 'Webhook endpoint not found');
	}

	await requireProjectAccess(event, existing.projectId);

	await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));

	return json({ success: true });
};
