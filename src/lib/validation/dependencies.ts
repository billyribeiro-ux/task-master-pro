import { z } from 'zod';

export const createDependencySchema = z
	.object({
		taskId: z.string().min(1),
		dependsOnTaskId: z.string().min(1),
		type: z.enum(['blocks', 'is_blocked_by', 'relates_to', 'duplicates']).default('blocks')
	})
	.refine((data) => data.taskId !== data.dependsOnTaskId, {
		message: 'A task cannot depend on itself',
		path: ['dependsOnTaskId']
	});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
