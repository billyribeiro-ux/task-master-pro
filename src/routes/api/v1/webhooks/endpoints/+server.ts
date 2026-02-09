import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { webhookEndpoints } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireProjectAccess } from '$lib/server/auth/guards.js';
import { createWebhookSchema } from '$lib/validation/webhooks.js';
import { randomBytes } from 'crypto';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = createWebhookSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	await requireProjectAccess(event, data.projectId);

	// Generate a signing secret for this endpoint
	const secret = randomBytes(32).toString('hex');

	const [endpoint] = await db
		.insert(webhookEndpoints)
		.values({
			projectId: data.projectId,
			createdBy: user.id,
			url: data.url,
			secret,
			events: data.events,
			isActive: true
		})
		.returning();

	return json(
		{
			id: endpoint.id,
			projectId: endpoint.projectId,
			url: endpoint.url,
			secret: endpoint.secret,
			events: endpoint.events,
			isActive: endpoint.isActive,
			createdAt: endpoint.createdAt
		},
		{ status: 201 }
	);
};

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) {
		throw error(400, 'projectId query parameter is required');
	}

	await requireProjectAccess(event, projectId);

	const endpoints = await db
		.select({
			id: webhookEndpoints.id,
			projectId: webhookEndpoints.projectId,
			url: webhookEndpoints.url,
			events: webhookEndpoints.events,
			isActive: webhookEndpoints.isActive,
			failureCount: webhookEndpoints.failureCount,
			lastTriggeredAt: webhookEndpoints.lastTriggeredAt,
			createdAt: webhookEndpoints.createdAt
		})
		.from(webhookEndpoints)
		.where(eq(webhookEndpoints.projectId, projectId))
		.orderBy(desc(webhookEndpoints.createdAt));

	return json(endpoints);
};
