import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { aiSuggestions, tasks } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { aiSuggestSchema } from '$lib/validation/ai.js';
import {
	generateTaskBreakdown,
	recommendPriority,
	recommendAssignee,
	detectDuplicates,
	estimateEffort,
	analyzeBlockers,
	generateProjectSummary
} from '$lib/server/ai/engine.js';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = aiSuggestSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { projectId, taskId, type } = result.data;
	await requireProjectAccess(event, projectId);

	// For task-specific suggestions, verify the task exists in the project
	if (taskId) {
		const [task] = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
			.limit(1);

		if (!task) throw error(404, 'Task not found');
	}

	let suggestion;

	try {
		switch (type) {
			case 'task_breakdown': {
				if (!taskId) throw error(400, 'taskId is required for task_breakdown');
				suggestion = await generateTaskBreakdown(projectId, taskId);
				break;
			}
			case 'priority_recommendation': {
				if (!taskId) throw error(400, 'taskId is required for priority_recommendation');
				suggestion = await recommendPriority(projectId, taskId);
				break;
			}
			case 'assignee_recommendation': {
				if (!taskId) throw error(400, 'taskId is required for assignee_recommendation');
				suggestion = await recommendAssignee(projectId, taskId);
				break;
			}
			case 'duplicate_detection': {
				if (!taskId) throw error(400, 'taskId is required for duplicate_detection');
				const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
				suggestion = await detectDuplicates(projectId, task.title, task.description ?? undefined);
				break;
			}
			case 'effort_estimate': {
				if (!taskId) throw error(400, 'taskId is required for effort_estimate');
				suggestion = await estimateEffort(projectId, taskId);
				break;
			}
			case 'blockers_analysis': {
				suggestion = await analyzeBlockers(projectId);
				break;
			}
			case 'summary': {
				suggestion = await generateProjectSummary(projectId);
				break;
			}
			default: {
				throw error(400, `Unsupported suggestion type: ${type}`);
			}
		}
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : 'AI suggestion generation failed';
		throw error(500, message);
	}

	// Store the suggestion
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

	const [saved] = await db
		.insert(aiSuggestions)
		.values({
			projectId,
			taskId: taskId ?? null,
			userId: event.locals.user.id,
			type: suggestion.type as typeof aiSuggestions.$inferInsert.type,
			title: suggestion.title,
			body: suggestion.body,
			confidence: suggestion.confidence,
			metadata: suggestion.metadata,
			status: 'pending',
			expiresAt
		})
		.returning();

	return json(saved, { status: 201 });
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const taskId = event.url.searchParams.get('taskId');
	const type = event.url.searchParams.get('type');
	const status = event.url.searchParams.get('status');

	const conditions = [eq(aiSuggestions.projectId, projectId)];

	if (taskId) {
		conditions.push(eq(aiSuggestions.taskId, taskId));
	}

	if (type) {
		conditions.push(eq(aiSuggestions.type, type as typeof aiSuggestions.$inferSelect.type));
	}

	if (status) {
		conditions.push(eq(aiSuggestions.status, status as typeof aiSuggestions.$inferSelect.status));
	}

	const suggestions = await db
		.select()
		.from(aiSuggestions)
		.where(and(...conditions))
		.orderBy(desc(aiSuggestions.createdAt))
		.limit(50);

	return json(suggestions);
};
