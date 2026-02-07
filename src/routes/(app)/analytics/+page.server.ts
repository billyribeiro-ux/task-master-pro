import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tasks, projects, projectMembers, timeEntries } from '$lib/server/db/schema.js';
import { eq, or, count, and, gte, inArray, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const userProjects = await db
		.select({ id: projects.id, name: projects.name })
		.from(projects)
		.leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
		.where(or(eq(projects.ownerId, user.id), eq(projectMembers.userId, user.id)))
		.groupBy(projects.id);

	const projectIds = userProjects.map((p) => p.id);

	if (projectIds.length === 0) {
		return {
			tasksByStatus: [],
			tasksByPriority: [],
			completionTrend: [],
			totalHoursLogged: 0,
			projectStats: []
		};
	}

	const tasksByStatus = await db
		.select({ status: tasks.status, total: count() })
		.from(tasks)
		.where(inArray(tasks.projectId, projectIds))
		.groupBy(tasks.status);

	const tasksByPriority = await db
		.select({ priority: tasks.priority, total: count() })
		.from(tasks)
		.where(inArray(tasks.projectId, projectIds))
		.groupBy(tasks.priority);

	const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

	const completionTrend = await db
		.select({
			date: sql<string>`date(${tasks.completedAt})`.as('date'),
			total: count()
		})
		.from(tasks)
		.where(
			and(
				inArray(tasks.projectId, projectIds),
				eq(tasks.status, 'done'),
				gte(tasks.completedAt, thirtyDaysAgo)
			)
		)
		.groupBy(sql`date(${tasks.completedAt})`)
		.orderBy(sql`date(${tasks.completedAt})`);

	const timeResult = await db
		.select({ total: sql<number>`COALESCE(SUM(${timeEntries.durationSeconds}), 0)`.as('total') })
		.from(timeEntries)
		.where(eq(timeEntries.userId, user.id));

	const totalHoursLogged = Math.round(((timeResult[0]?.total ?? 0) / 3600) * 10) / 10;

	const projectStats = await Promise.all(
		userProjects.map(async (project) => {
			const [taskCount] = await db
				.select({ total: count() })
				.from(tasks)
				.where(eq(tasks.projectId, project.id));

			const [doneCount] = await db
				.select({ total: count() })
				.from(tasks)
				.where(and(eq(tasks.projectId, project.id), eq(tasks.status, 'done')));

			return {
				id: project.id,
				name: project.name,
				totalTasks: taskCount?.total ?? 0,
				completedTasks: doneCount?.total ?? 0
			};
		})
	);

	return {
		tasksByStatus,
		tasksByPriority,
		completionTrend,
		totalHoursLogged,
		projectStats
	};
};
