import { z } from 'zod';

export const createWebhookSchema = z.object({
	projectId: z.string().min(1),
	url: z.string().url('Must be a valid HTTPS URL').startsWith('https://', 'Webhook URL must use HTTPS'),
	events: z
		.array(
			z.enum([
				'task.created',
				'task.updated',
				'task.deleted',
				'task.moved',
				'task.completed',
				'comment.created',
				'member.added',
				'member.removed',
				'label.created',
				'time_entry.created',
				'time_entry.stopped'
			])
		)
		.min(1, 'At least one event is required')
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
	url: z.string().url().startsWith('https://').optional(),
	events: z
		.array(
			z.enum([
				'task.created',
				'task.updated',
				'task.deleted',
				'task.moved',
				'task.completed',
				'comment.created',
				'member.added',
				'member.removed',
				'label.created',
				'time_entry.created',
				'time_entry.stopped'
			])
		)
		.min(1)
		.optional(),
	isActive: z.boolean().optional()
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
