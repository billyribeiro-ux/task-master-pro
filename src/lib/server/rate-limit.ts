import { getRedis } from './redis.js';
import { logger } from './logger.js';

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

// ─── In-memory fallback (single-instance / no Redis) ─────────────────────────

const memoryStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupMemoryStore(now: number) {
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
	lastCleanup = now;
	for (const [key, value] of memoryStore) {
		if (now > value.resetAt) memoryStore.delete(key);
	}
}

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
	const now = Date.now();
	cleanupMemoryStore(now);

	const entry = memoryStore.get(key);
	if (!entry || now > entry.resetAt) {
		const resetAt = now + windowMs;
		memoryStore.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: limit - 1, resetAt };
	}

	if (entry.count >= limit) {
		return { allowed: false, remaining: 0, resetAt: entry.resetAt };
	}

	entry.count++;
	return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ─── Redis fixed-window counter ──────────────────────────────────────────────

/**
 * Distributed fixed-window rate limit. Uses a Redis INCR + PEXPIRE pipeline so
 * the limit is shared across every app instance. If Redis is unconfigured or
 * unreachable the call transparently falls back to an in-process counter so the
 * request path never fails closed on infrastructure issues.
 */
export async function checkRateLimit(
	key: string,
	limit: number,
	windowMs: number
): Promise<RateLimitResult> {
	const redis = getRedis();
	if (!redis || redis.status !== 'ready') {
		return checkMemory(key, limit, windowMs);
	}

	const redisKey = `ratelimit:${key}`;
	try {
		const results = await redis.multi().incr(redisKey).pttl(redisKey).exec();

		if (!results) return checkMemory(key, limit, windowMs);

		const count = Number(results[0]?.[1] ?? 0);
		let ttl = Number(results[1]?.[1] ?? -1);

		// First hit in this window — set the expiry.
		if (ttl < 0) {
			await redis.pexpire(redisKey, windowMs);
			ttl = windowMs;
		}

		const resetAt = Date.now() + ttl;
		if (count > limit) {
			return { allowed: false, remaining: 0, resetAt };
		}
		return { allowed: true, remaining: Math.max(0, limit - count), resetAt };
	} catch (err) {
		logger.error({ err, key }, 'Redis rate limit failed — falling back to in-process counter');
		return checkMemory(key, limit, windowMs);
	}
}
