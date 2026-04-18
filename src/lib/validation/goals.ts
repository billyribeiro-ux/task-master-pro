import { z } from 'zod';

export const createGoalSchema = z.object({
	projectId: z.string().optional(),
	parentGoalId: z.string().optional(),
	title: z.string().min(1).max(300),
	description: z.string().max(5000).optional(),
	type: z.enum(['objective', 'key_result', 'initiative']),
	progressType: z
		.enum(['manual', 'task_count', 'task_story_points', 'key_result_average'])
		.default('manual'),
	progressTarget: z.number().min(0).default(100),
	unit: z.string().max(20).default('%'),
	startDate: z.string().optional(),
	dueDate: z.string().optional()
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z.object({
	title: z.string().min(1).max(300).optional(),
	description: z.string().max(5000).nullable().optional(),
	status: z
		.enum(['draft', 'active', 'at_risk', 'behind', 'on_track', 'completed', 'cancelled'])
		.optional(),
	progressCurrent: z.number().min(0).optional(),
	progressTarget: z.number().min(0).optional(),
	unit: z.string().max(20).optional(),
	startDate: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional()
});

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const createCheckInSchema = z.object({
	goalId: z.string().min(1),
	newValue: z.number().min(0),
	note: z.string().max(2000).optional()
});

export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;

export const linkTaskToGoalSchema = z.object({
	goalId: z.string().min(1),
	taskId: z.string().min(1)
});

export type LinkTaskToGoalInput = z.infer<typeof linkTaskToGoalSchema>;
