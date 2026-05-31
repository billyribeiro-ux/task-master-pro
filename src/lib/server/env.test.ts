import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable mocks for the SvelteKit-provided modules.
const appEnv = { building: false, dev: true };
const privateEnv: { env: Record<string, string | undefined> } = { env: {} };

vi.mock('$app/environment', () => ({
	get building() {
		return appEnv.building;
	},
	get dev() {
		return appEnv.dev;
	}
}));
vi.mock('$env/dynamic/private', () => ({
	get env() {
		return privateEnv.env;
	}
}));
vi.mock('./logger.js', () => ({
	logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

import { validateEnv } from './env.js';

describe('validateEnv', () => {
	beforeEach(() => {
		appEnv.building = false;
		appEnv.dev = true;
		privateEnv.env = {};
	});

	it('is a no-op during build', () => {
		appEnv.building = true;
		appEnv.dev = false;
		expect(() => validateEnv()).not.toThrow();
	});

	it('does not throw in dev even with empty env', () => {
		appEnv.dev = true;
		expect(() => validateEnv()).not.toThrow();
	});

	it('throws in production when ORIGIN is missing', () => {
		appEnv.dev = false;
		privateEnv.env = { DATABASE_URL: 'file:./x.db' };
		expect(() => validateEnv()).toThrow(/ORIGIN/);
	});

	it('passes in production when core config is present', () => {
		appEnv.dev = false;
		privateEnv.env = {
			DATABASE_URL: 'libsql://prod',
			ORIGIN: 'https://app.example.com'
		};
		expect(() => validateEnv()).not.toThrow();
	});

	it('rejects an invalid ORIGIN url in production', () => {
		appEnv.dev = false;
		privateEnv.env = { DATABASE_URL: 'file:./x.db', ORIGIN: 'not-a-url' };
		expect(() => validateEnv()).toThrow();
	});
});
