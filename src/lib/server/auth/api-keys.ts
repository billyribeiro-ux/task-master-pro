import { createHash, randomBytes } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { apiKeys, users } from '$lib/server/db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { SessionUser } from './index.js';

const API_KEY_PREFIX = 'tmk_';
const API_KEY_BYTE_LENGTH = 32;

/**
 * Generate a random API key with the `tmk_` prefix.
 * Returns the raw key string (only shown once to the user).
 */
export function generateApiKey(): string {
	const bytes = randomBytes(API_KEY_BYTE_LENGTH);
	const encoded = bytes.toString('base64url');
	return `${API_KEY_PREFIX}${encoded}`;
}

/**
 * SHA-256 hash an API key for secure storage.
 */
export function hashApiKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

/**
 * Extract the visible prefix portion of an API key (first 8 chars after `tmk_`).
 */
export function extractKeyPrefix(key: string): string {
	return key.substring(0, API_KEY_PREFIX.length + 8);
}

/**
 * Validate a raw API key: hash it, look up the record, check expiry/revocation,
 * resolve the owning user, and return as SessionUser (or null).
 */
export async function validateApiKey(rawKey: string): Promise<SessionUser | null> {
	const keyHash = hashApiKey(rawKey);

	const [record] = await db
		.select()
		.from(apiKeys)
		.where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
		.limit(1);

	if (!record) {
		return null;
	}

	if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
		return null;
	}

	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			avatarUrl: users.avatarUrl,
			role: users.role,
			plan: users.plan,
			stripeCustomerId: users.stripeCustomerId
		})
		.from(users)
		.where(eq(users.id, record.userId))
		.limit(1);

	if (!user) {
		return null;
	}

	// Update last used timestamp (fire-and-forget)
	db.update(apiKeys)
		.set({ lastUsedAt: new Date().toISOString() })
		.where(eq(apiKeys.id, record.id))
		.then(() => {});

	return user as SessionUser;
}
