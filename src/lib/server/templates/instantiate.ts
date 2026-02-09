import { db } from '$lib/server/db/index.js';
import {
	projects,
	projectMembers,
	columns,
	labels,
	tasks,
	customFieldDefinitions,
	automationRules,
	projectTemplates
} from '$lib/server/db/schema.js';
import { eq, count } from 'drizzle-orm';
import { generateKeyBetween } from '$lib/utils/fractional-index.js';

/**
 * Create a new project from a template, including columns, labels,
 * task templates, custom fields, and automation rules.
 */
export async function instantiateTemplate(
	templateId: string,
	userId: string,
	projectName: string,
	projectDescription?: string
) {
	// Fetch the template
	const [template] = await db
		.select()
		.from(projectTemplates)
		.where(eq(projectTemplates.id, templateId))
		.limit(1);

	if (!template) {
		throw new Error('Template not found');
	}

	const data = template.templateData;

	// Generate a slug from the project name
	const slug =
		projectName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') +
		'-' +
		Date.now().toString(36);

	// Create the project
	const [project] = await db
		.insert(projects)
		.values({
			name: projectName,
			slug,
			description: projectDescription ?? template.description ?? null,
			ownerId: userId,
			visibility: 'private'
		})
		.returning();

	// Add creator as project owner
	await db.insert(projectMembers).values({
		projectId: project.id,
		userId,
		role: 'owner'
	});

	// Create columns
	const columnMap: Record<number, string> = {};
	for (const col of data.columns) {
		const [createdColumn] = await db
			.insert(columns)
			.values({
				projectId: project.id,
				name: col.name,
				position: col.position,
				color: col.color,
				wipLimit: col.wipLimit ?? null
			})
			.returning();
		columnMap[col.position] = createdColumn.id;
	}

	// Create labels
	const labelMap: Record<string, string> = {};
	for (const lbl of data.labels) {
		const [createdLabel] = await db
			.insert(labels)
			.values({
				projectId: project.id,
				name: lbl.name,
				color: lbl.color
			})
			.returning();
		labelMap[lbl.name] = createdLabel.id;
	}

	// Create task templates
	if (data.taskTemplates && data.taskTemplates.length > 0) {
		// Track positions per column for fractional indexing
		const columnPositions: Record<string, string | null> = {};

		for (const taskTemplate of data.taskTemplates) {
			const columnId = columnMap[taskTemplate.columnIndex];
			if (!columnId) continue;

			const lastPosition = columnPositions[columnId] ?? null;
			const position = generateKeyBetween(lastPosition, null);
			columnPositions[columnId] = position;

			// Count existing tasks for display ID
			const [taskCountResult] = await db
				.select({ total: count() })
				.from(tasks)
				.where(eq(tasks.projectId, project.id));

			const taskNumber = (taskCountResult?.total ?? 0) + 1;
			const displayId = `TM-${taskNumber}`;

			await db.insert(tasks).values({
				displayId,
				projectId: project.id,
				columnId,
				title: taskTemplate.title,
				description: taskTemplate.description ?? null,
				priority: taskTemplate.priority as 'none' | 'low' | 'medium' | 'high' | 'urgent',
				status: 'todo',
				reporterId: userId,
				position,
				storyPoints: taskTemplate.storyPoints ?? null,
				estimateMinutes: taskTemplate.estimateMinutes ?? null
			});
		}
	}

	// Create custom fields
	if (data.customFields && data.customFields.length > 0) {
		for (let i = 0; i < data.customFields.length; i++) {
			const field = data.customFields[i];
			await db.insert(customFieldDefinitions).values({
				projectId: project.id,
				name: field.name,
				slug: field.slug,
				fieldType: field.fieldType as 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'url' | 'email' | 'checkbox' | 'currency',
				options: field.options ?? null,
				position: i
			});
		}
	}

	// Create automation rules
	if (data.automationRules && data.automationRules.length > 0) {
		for (const rule of data.automationRules) {
			await db.insert(automationRules).values({
				projectId: project.id,
				createdBy: userId,
				name: rule.name,
				trigger: rule.trigger,
				actions: rule.actions,
				isActive: true
			});
		}
	}

	// Increment the template usage count
	await db
		.update(projectTemplates)
		.set({ usageCount: (template.usageCount ?? 0) + 1 })
		.where(eq(projectTemplates.id, templateId));

	return project;
}
