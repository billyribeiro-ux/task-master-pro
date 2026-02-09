import { z } from 'zod';

export const aiChatSchema = z.object({
	projectId: z.string().min(1),
	conversationId: z.string().optional(),
	message: z.string().min(1).max(10000),
	context: z
		.object({
			taskIds: z.array(z.string()).optional(),
			scope: z.enum(['project', 'task', 'global']).default('project')
		})
		.optional()
});

export type AiChatInput = z.infer<typeof aiChatSchema>;

export const aiSuggestSchema = z.object({
	projectId: z.string().min(1),
	taskId: z.string().optional(),
	type: z.enum([
		'task_breakdown',
		'priority_recommendation',
		'assignee_recommendation',
		'duplicate_detection',
		'effort_estimate',
		'risk_flag',
		'dependency_suggestion',
		'label_suggestion',
		'summary',
		'blockers_analysis'
	])
});

export type AiSuggestInput = z.infer<typeof aiSuggestSchema>;

export const aiSuggestionActionSchema = z.object({
	suggestionId: z.string().min(1),
	action: z.enum(['accept', 'dismiss'])
});

export type AiSuggestionActionInput = z.infer<typeof aiSuggestionActionSchema>;

export const aiNaturalLanguageTaskSchema = z.object({
	projectId: z.string().min(1),
	input: z.string().min(1).max(5000),
	autoCreate: z.boolean().default(false)
});

export type AiNaturalLanguageTaskInput = z.infer<typeof aiNaturalLanguageTaskSchema>;
