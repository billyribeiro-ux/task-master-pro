import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, tasks, projectMembers, timeEntries } from '$lib/server/db/schema.js';
import { eq, or, count, and, gte, inArray, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const userProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			description: projects.description,
			slug: projects.slug
		})
		.from(projects)
		.leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
		.where(or(eq(projects.ownerId, user.id), eq(projectMembers.userId, user.id)))
		.groupBy(projects.id)
		.limit(10);

	const projectIds = userProjects.map((p) => p.id);

	let taskCount = 0;
	let completedThisWeek = 0;
	let hoursLoggedThisWeek = 0;

	if (projectIds.length > 0) {
		const [openResult] = await db
			.select({ total: count() })
			.from(tasks)
			.where(
				and(
					inArray(tasks.projectId, projectIds),
					inArray(tasks.status, ['todo', 'in_progress', 'in_review', 'backlog'])
				)
			);
		taskCount = openResult?.total ?? 0;

		const weekAgo = subDays(new Date(), 7).toISOString();

		const [completedResult] = await db
			.select({ total: count() })
			.from(tasks)
			.where(
				and(
					inArray(tasks.projectId, projectIds),
					eq(tasks.status, 'done'),
					gte(tasks.completedAt, weekAgo)
				)
			);
		completedThisWeek = completedResult?.total ?? 0;

		const [timeResult] = await db
			.select({
				totalSeconds: sql<number>`coalesce(sum(${timeEntries.durationSeconds}), 0)`
			})
			.from(timeEntries)
			.where(and(eq(timeEntries.userId, user.id), gte(timeEntries.startedAt, weekAgo)));
		const totalSeconds = timeResult?.totalSeconds ?? 0;
		hoursLoggedThisWeek = Math.round((totalSeconds / 3600) * 10) / 10;
	}

	return {
		projectCount: userProjects.length,
		taskCount,
		completedThisWeek,
		hoursLoggedThisWeek,
		recentProjects: userProjects.slice(0, 5)
	};
};
