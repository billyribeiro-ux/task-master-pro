import { z } from 'zod';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { logger } from './logger.js';

/**
 * Centralised environment validation.
 *
 * Runs once at server startup (imported from `hooks.server.ts`). Truly required
 * settings are enforced in production; feature-specific integrations (OAuth,
 * Stripe, S3, AI) only warn when absent so partial deployments still boot. In
 * dev nothing is fatal — we log a single structured summary instead.
 */
const schema = z.object({
	// Core
	DATABASE_URL: z.string().min(1).default('file:./local.db'),
	ORIGIN: z.string().url().optional(),

	// OAuth (feature: social login)
	GITHUB_CLIENT_ID: z.string().optional(),
	GITHUB_CLIENT_SECRET: z.string().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),

	// Billing (feature: Stripe)
	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),

	// Storage (feature: file attachments)
	S3_ENDPOINT: z.string().optional(),
	S3_BUCKET: z.string().optional(),

	// Realtime / rate limiting (feature: distributed)
	REDIS_URL: z.string().optional(),

	// AI (feature: assistant)
	AI_PROVIDER_URL: z.string().optional(),
	AI_API_KEY: z.string().optional()
});

const featureGroups: Record<string, string[]> = {
	'GitHub OAuth': ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
	'Google OAuth': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
	'Stripe billing': ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
	'S3 storage': ['S3_ENDPOINT', 'S3_BUCKET'],
	'Redis (distributed rate limiting)': ['REDIS_URL'],
	'AI assistant': ['AI_PROVIDER_URL', 'AI_API_KEY']
};

export function validateEnv(): void {
	// `building` is true during `vite build`; skip so the build never needs secrets.
	if (building) return;

	const result = schema.safeParse(env);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
		if (dev) {
			logger.warn({ issues }, 'Environment validation warnings');
		} else {
			throw new Error(`Invalid environment configuration: ${issues}`);
		}
		return;
	}

	if (!dev && !result.data.ORIGIN) {
		throw new Error('ORIGIN must be set in production for secure cookies and CORS');
	}

	const disabledFeatures: string[] = [];
	for (const [feature, keys] of Object.entries(featureGroups)) {
		if (keys.some((k) => !env[k])) disabledFeatures.push(feature);
	}
	if (disabledFeatures.length > 0) {
		logger.warn({ disabledFeatures }, 'Some integrations are not configured and will be disabled');
	}
}
