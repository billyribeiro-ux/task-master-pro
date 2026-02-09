import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { apiKeys } from '$lib/server/db/schema.js';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { createApiKeySchema } from '$lib/validation/api-keys.js';
import { generateApiKey, hashApiKey, extractKeyPrefix } from '$lib/server/auth/api-keys.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = createApiKeySchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const data = result.data;
	const rawKey = generateApiKey();
	const keyHash = hashApiKey(rawKey);
	const keyPrefix = extractKeyPrefix(rawKey);

	let expiresAt: string | null = null;
	if (data.expiresInDays) {
		const expiry = new Date();
		expiry.setDate(expiry.getDate() + data.expiresInDays);
		expiresAt = expiry.toISOString();
	}

	const [apiKey] = await db
		.insert(apiKeys)
		.values({
			userId: user.id,
			name: data.name,
			keyHash,
			keyPrefix,
			scopes: data.scopes,
			expiresAt
		})
		.returning();

	return json(
		{
			id: apiKey.id,
			name: apiKey.name,
			key: rawKey,
			keyPrefix: apiKey.keyPrefix,
			scopes: apiKey.scopes,
			expiresAt: apiKey.expiresAt,
			createdAt: apiKey.createdAt
		},
		{ status: 201 }
	);
};

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const includeRevoked = event.url.searchParams.get('includeRevoked') === 'true';

	const conditions = [eq(apiKeys.userId, user.id)];
	if (!includeRevoked) {
		conditions.push(isNull(apiKeys.revokedAt));
	}

	const keys = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			scopes: apiKeys.scopes,
			lastUsedAt: apiKeys.lastUsedAt,
			expiresAt: apiKeys.expiresAt,
			revokedAt: apiKeys.revokedAt,
			createdAt: apiKeys.createdAt
		})
		.from(apiKeys)
		.where(and(...conditions))
		.orderBy(desc(apiKeys.createdAt));

	return json(keys);
};
