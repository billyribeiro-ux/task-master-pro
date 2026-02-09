import { z } from 'zod';

export const createApiKeySchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	scopes: z
		.array(
			z.enum([
				'tasks:read',
				'tasks:write',
				'projects:read',
				'projects:write',
				'comments:read',
				'comments:write',
				'time_entries:read',
				'time_entries:write',
				'labels:read',
				'labels:write',
				'webhooks:manage',
				'files:read',
				'files:write'
			])
		)
		.min(1, 'At least one scope is required'),
	expiresInDays: z.number().int().min(1).max(365).optional()
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const listApiKeysSchema = z.object({
	includeRevoked: z.boolean().optional().default(false)
});
