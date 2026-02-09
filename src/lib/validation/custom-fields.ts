import { z } from 'zod';

const selectOption = z.object({
	label: z.string().min(1).max(100),
	value: z.string().min(1).max(100),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional()
});

export const createCustomFieldSchema = z
	.object({
		projectId: z.string().min(1),
		name: z.string().min(1).max(100),
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
		description: z.string().max(500).optional(),
		isRequired: z.boolean().default(false),
		options: z.array(selectOption).optional(),
		defaultValue: z.string().optional()
	})
	.refine(
		(data) => {
			if (data.fieldType === 'select' || data.fieldType === 'multi_select') {
				return data.options && data.options.length > 0;
			}
			return true;
		},
		{ message: 'Select fields require at least one option', path: ['options'] }
	);

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;

export const updateCustomFieldSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).nullable().optional(),
	isRequired: z.boolean().optional(),
	options: z.array(selectOption).optional(),
	defaultValue: z.string().nullable().optional(),
	position: z.number().int().min(0).optional()
});

export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;

export const setCustomFieldValueSchema = z.object({
	taskId: z.string().min(1),
	fieldId: z.string().min(1),
	value: z.string().nullable().optional(),
	numericValue: z.number().nullable().optional(),
	dateValue: z.string().nullable().optional()
});

export type SetCustomFieldValueInput = z.infer<typeof setCustomFieldValueSchema>;
