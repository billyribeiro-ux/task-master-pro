import Redis from 'ioredis';
import { env } from '$env/dynamic/private';
import { logger } from './logger.js';

/**
 * Lazily-created, shared ioredis client.
 *
 * Returns `null` when `REDIS_URL` is not configured (e.g. local dev), which lets
 * callers transparently fall back to in-process behaviour. The connection is
 * created with `lazyConnect` so importing this module never blocks startup, and
 * a single `error` listener prevents unhandled-rejection crashes if Redis goes
 * away at runtime.
 */
let client: Redis | null = null;
let initialized = false;

export function getRedis(): Redis | null {
	if (initialized) return client;
	initialized = true;

	const url = env.REDIS_URL;
	if (!url) {
		logger.warn('REDIS_URL not set — Redis-backed features fall back to in-process behaviour');
		return null;
	}

	client = new Redis(url, {
		lazyConnect: true,
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
		retryStrategy: (times) => Math.min(times * 200, 2000)
	});

	client.on('error', (err) => {
		logger.error({ err }, 'Redis connection error');
	});

	client.connect().catch((err) => {
		logger.error({ err }, 'Initial Redis connection failed — falling back to in-process behaviour');
	});

	return client;
}
