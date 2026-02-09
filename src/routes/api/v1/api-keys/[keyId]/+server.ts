import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { apiKeys } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';

export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const { keyId } = event.params;

	const [existing] = await db
		.select()
		.from(apiKeys)
		.where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
		.limit(1);

	if (!existing) {
		throw error(404, 'API key not found');
	}

	if (existing.revokedAt) {
		throw error(400, 'API key is already revoked');
	}

	const [revoked] = await db
		.update(apiKeys)
		.set({ revokedAt: new Date().toISOString() })
		.where(eq(apiKeys.id, keyId))
		.returning();

	return json({
		id: revoked.id,
		name: revoked.name,
		keyPrefix: revoked.keyPrefix,
		revokedAt: revoked.revokedAt
	});
};
