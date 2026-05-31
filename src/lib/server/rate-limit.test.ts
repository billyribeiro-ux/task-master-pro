import { describe, it, expect, beforeEach, vi } from 'vitest';

// No REDIS_URL in the test env, so checkRateLimit exercises the in-memory path.
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { checkRateLimit } from './rate-limit.js';

describe('checkRateLimit (in-memory fallback)', () => {
	let key: string;

	beforeEach(() => {
		key = `test:${Math.random().toString(36).slice(2)}`;
	});

	it('allows requests up to the limit and reports remaining', async () => {
		const first = await checkRateLimit(key, 3, 60_000);
		expect(first.allowed).toBe(true);
		expect(first.remaining).toBe(2);

		const second = await checkRateLimit(key, 3, 60_000);
		expect(second.allowed).toBe(true);
		expect(second.remaining).toBe(1);

		const third = await checkRateLimit(key, 3, 60_000);
		expect(third.allowed).toBe(true);
		expect(third.remaining).toBe(0);
	});

	it('blocks requests once the limit is exceeded', async () => {
		await checkRateLimit(key, 2, 60_000);
		await checkRateLimit(key, 2, 60_000);
		const blocked = await checkRateLimit(key, 2, 60_000);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.resetAt).toBeGreaterThan(Date.now());
	});

	it('resets the window after it elapses', async () => {
		vi.useFakeTimers();
		try {
			await checkRateLimit(key, 1, 1_000);
			const blocked = await checkRateLimit(key, 1, 1_000);
			expect(blocked.allowed).toBe(false);

			vi.advanceTimersByTime(1_001);

			const afterReset = await checkRateLimit(key, 1, 1_000);
			expect(afterReset.allowed).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('tracks separate keys independently', async () => {
		const a = await checkRateLimit(`${key}:a`, 1, 60_000);
		const b = await checkRateLimit(`${key}:b`, 1, 60_000);
		expect(a.allowed).toBe(true);
		expect(b.allowed).toBe(true);
	});
});
