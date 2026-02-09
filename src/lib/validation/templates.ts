import { z } from 'zod';

export const createTemplateSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	category: z
		.enum(['engineering', 'marketing', 'design', 'operations', 'sales', 'hr', 'custom'])
		.default('custom'),
	isPublic: z.boolean().default(false),
	templateData: z.object({
		columns: z
			.array(
				z.object({
					name: z.string().min(1).max(100),
					position: z.number().int().min(0),
					color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
					wipLimit: z.number().int().min(0).optional()
				})
			)
			.min(1, 'At least one column is required'),
		taskTemplates: z
			.array(
				z.object({
					title: z.string().min(1).max(500),
					description: z.string().max(10000).optional(),
					priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).default('none'),
					columnIndex: z.number().int().min(0),
					labels: z.array(z.string()).optional(),
					storyPoints: z.number().int().min(0).optional(),
					estimateMinutes: z.number().int().min(0).optional()
				})
			)
			.default([]),
		labels: z
			.array(
				z.object({
					name: z.string().min(1).max(50),
					color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
				})
			)
			.default([]),
		customFields: z
			.array(
				z.object({
					name: z.string().min(1).max(100),
					slug: z.string().min(1).max(100),
					fieldType: z.enum([
						'text',
						'number',
						'date',
						'select',
						'multi_select',
						'url',
						'email',
						'checkbox',
						'currency'
					]),
					options: z
						.array(
							z.object({
								label: z.string(),
								value: z.string(),
								color: z.string().optional()
							})
						)
						.optional()
				})
			)
			.optional(),
		automationRules: z
			.array(
				z.object({
					name: z.string().min(1),
					trigger: z.object({
						event: z.string(),
						conditions: z.array(
							z.object({
								field: z.string(),
								operator: z.string(),
								value: z.unknown()
							})
						)
					}),
					actions: z.array(
						z.object({
							type: z.string(),
							params: z.record(z.string(), z.unknown())
						})
					)
				})
			)
			.optional()
	})
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const applyTemplateSchema = z.object({
	templateId: z.string().min(1),
	projectName: z.string().min(1).max(100),
	projectDescription: z.string().max(500).optional()
});

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
