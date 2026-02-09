import { z } from 'zod';

const conditionSchema = z.object({
	field: z.string().min(1),
	operator: z.enum(['equals', 'not_equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in', 'is_empty', 'is_not_empty']),
	value: z.unknown()
});

const triggerSchema = z.object({
	event: z.enum([
		'task.created',
		'task.updated',
		'task.moved',
		'task.completed',
		'task.overdue',
		'comment.created',
		'member.added',
		'label.added',
		'label.removed',
		'time_entry.stopped',
		'schedule.cron'
	]),
	conditions: z.array(conditionSchema).default([])
});

const actionSchema = z.object({
	type: z.enum([
		'set_field',
		'assign_user',
		'add_label',
		'remove_label',
		'move_column',
		'set_priority',
		'set_status',
		'add_comment',
		'send_notification',
		'trigger_webhook',
		'create_subtask'
	]),
	params: z.record(z.string(), z.unknown())
});

export const createAutomationSchema = z.object({
	projectId: z.string().min(1),
	name: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	trigger: triggerSchema,
	actions: z.array(actionSchema).min(1, 'At least one action is required').max(10)
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;

export const updateAutomationSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	description: z.string().max(1000).nullable().optional(),
	trigger: triggerSchema.optional(),
	actions: z.array(actionSchema).min(1).max(10).optional(),
	isActive: z.boolean().optional()
});

export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
