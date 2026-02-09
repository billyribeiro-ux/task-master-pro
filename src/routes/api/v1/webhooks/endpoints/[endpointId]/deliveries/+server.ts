import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { webhookEndpoints, webhookDeliveries } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireProjectAccess } from '$lib/server/auth/guards.js';

export const GET: RequestHandler = async (event) => {
	requireAuth(event);
	const { endpointId } = event.params;

	// Verify the endpoint exists and user has project access
	const [endpoint] = await db
		.select()
		.from(webhookEndpoints)
		.where(eq(webhookEndpoints.id, endpointId))
		.limit(1);

	if (!endpoint) {
		throw error(404, 'Webhook endpoint not found');
	}

	await requireProjectAccess(event, endpoint.projectId);

	const limit = Math.min(parseInt(event.url.searchParams.get('limit') ?? '50', 10), 100);
	const offset = parseInt(event.url.searchParams.get('offset') ?? '0', 10);

	const deliveries = await db
		.select()
		.from(webhookDeliveries)
		.where(eq(webhookDeliveries.endpointId, endpointId))
		.orderBy(desc(webhookDeliveries.createdAt))
		.limit(limit)
		.offset(offset);

	return json(deliveries);
};
