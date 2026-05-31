import { describe, it, expect } from 'vitest';
import { generateKeyBetween, generateNKeysBetween } from './fractional-index.js';

describe('generateKeyBetween', () => {
	it('returns a stable first key when both bounds are null', () => {
		expect(generateKeyBetween(null, null)).toBe('a0');
	});

	it('produces a key strictly greater than the lower bound when upper is null', () => {
		const key = generateKeyBetween('a0', null);
		expect(key > 'a0').toBe(true);
	});

	it('produces a key strictly less than the upper bound when lower is null', () => {
		const key = generateKeyBetween(null, 'a0');
		expect(key < 'a0').toBe(true);
	});

	it('produces a key strictly between two adjacent bounds', () => {
		const a = 'a0';
		const b = 'a1';
		const mid = generateKeyBetween(a, b);
		expect(mid > a).toBe(true);
		expect(mid < b).toBe(true);
	});

	it('throws when the lower bound is not less than the upper bound', () => {
		expect(() => generateKeyBetween('a1', 'a0')).toThrow();
		expect(() => generateKeyBetween('a0', 'a0')).toThrow();
	});

	it('keeps ordering stable across repeated midpoint insertions', () => {
		let lo = 'a0';
		const hi = 'b0';
		const keys: string[] = [];
		for (let i = 0; i < 50; i++) {
			const next = generateKeyBetween(lo, hi);
			expect(next > lo).toBe(true);
			expect(next < hi).toBe(true);
			keys.push(next);
			lo = next;
		}
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});
});

describe('generateNKeysBetween', () => {
	it('returns an empty array for n = 0', () => {
		expect(generateNKeysBetween(null, null, 0)).toEqual([]);
	});

	it('returns exactly n keys', () => {
		expect(generateNKeysBetween(null, null, 5)).toHaveLength(5);
	});

	it('returns strictly ascending keys', () => {
		const keys = generateNKeysBetween(null, null, 20);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('keeps all generated keys within the provided bounds', () => {
		const keys = generateNKeysBetween('a0', 'z0', 10);
		for (const key of keys) {
			expect(key > 'a0').toBe(true);
			expect(key < 'z0').toBe(true);
		}
	});
});
