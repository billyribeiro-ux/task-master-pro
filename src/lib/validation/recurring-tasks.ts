import { z } from 'zod';

export const createRecurringTaskSchema = z.object({
	projectId: z.string().min(1),
	title: z.string().min(1).max(500),
	description: z.string().max(10000).optional(),
	columnId: z.string().min(1),
	assigneeId: z.string().optional(),
	priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).default('none'),
	storyPoints: z.number().int().min(0).optional(),
	estimateMinutes: z.number().int().min(0).optional(),
	labelIds: z.array(z.string()).optional(),
	rrule: z
		.string()
		.min(1, 'Recurrence rule is required')
		.regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/, 'Must be a valid RRULE string'),
	timezone: z.string().default('UTC'),
	endsAt: z.string().optional(),
	maxOccurrences: z.number().int().min(1).max(1000).optional()
});

export type CreateRecurringTaskInput = z.infer<typeof createRecurringTaskSchema>;

export const updateRecurringTaskSchema = z.object({
	title: z.string().min(1).max(500).optional(),
	description: z.string().max(10000).nullable().optional(),
	columnId: z.string().optional(),
	assigneeId: z.string().nullable().optional(),
	priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
	storyPoints: z.number().int().min(0).nullable().optional(),
	estimateMinutes: z.number().int().min(0).nullable().optional(),
	labelIds: z.array(z.string()).optional(),
	rrule: z
		.string()
		.regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/)
		.optional(),
	timezone: z.string().optional(),
	isActive: z.boolean().optional(),
	endsAt: z.string().nullable().optional(),
	maxOccurrences: z.number().int().min(1).max(1000).nullable().optional()
});

export type UpdateRecurringTaskInput = z.infer<typeof updateRecurringTaskSchema>;
