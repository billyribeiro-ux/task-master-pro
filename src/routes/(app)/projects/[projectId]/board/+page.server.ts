import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tasks, labels, taskLabels, users } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	const { project } = await parent();

	const projectTasks = await db
		.select({
			id: tasks.id,
			displayId: tasks.displayId,
			title: tasks.title,
			description: tasks.description,
			priority: tasks.priority,
			status: tasks.status,
			columnId: tasks.columnId,
			position: tasks.position,
			assigneeId: tasks.assigneeId,
			reporterId: tasks.reporterId,
			dueDate: tasks.dueDate,
			storyPoints: tasks.storyPoints,
			estimateMinutes: tasks.estimateMinutes,
			createdAt: tasks.createdAt,
			updatedAt: tasks.updatedAt
		})
		.from(tasks)
		.where(eq(tasks.projectId, project.id))
		.orderBy(tasks.position);

	const taskIds = projectTasks.map((t) => t.id);

	const taskLabelMap: Record<string, Array<{ id: string; name: string; color: string }>> = {};

	if (taskIds.length > 0) {
		const projectLabels = await db.select().from(labels).where(eq(labels.projectId, project.id));

		const labelAssignments = await db
			.select()
			.from(taskLabels)
			.where(inArray(taskLabels.taskId, taskIds));

		const labelById = new Map(projectLabels.map((l) => [l.id, l]));

		for (const assignment of labelAssignments) {
			const label = labelById.get(assignment.labelId);
			if (label) {
				if (!taskLabelMap[assignment.taskId]) {
					taskLabelMap[assignment.taskId] = [];
				}
				taskLabelMap[assignment.taskId].push({
					id: label.id,
					name: label.name,
					color: label.color
				});
			}
		}
	}

	const assigneeIds = [
		...new Set(projectTasks.map((t) => t.assigneeId).filter(Boolean))
	] as string[];
	const assigneeMap: Record<string, { name: string; avatarUrl: string | null }> = {};

	if (assigneeIds.length > 0) {
		const assignees = await db
			.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
			.from(users)
			.where(inArray(users.id, assigneeIds));

		for (const a of assignees) {
			assigneeMap[a.id] = { name: a.name, avatarUrl: a.avatarUrl };
		}
	}

	return {
		tasks: projectTasks,
		taskLabels: taskLabelMap,
		assignees: assigneeMap,
		labels: await db.select().from(labels).where(eq(labels.projectId, project.id))
	};
};
