import type { LayoutServerLoad } from './$types.js';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { db } from '$lib/server/db/index.js';
import { projects, columns, projectMembers, users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const { projectId } = event.params;
	await requireProjectAccess(event, projectId);

	const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

	if (!project) {
		throw error(404, 'Project not found');
	}

	const projectColumns = await db
		.select()
		.from(columns)
		.where(eq(columns.projectId, projectId))
		.orderBy(columns.position);

	const members = await db
		.select({
			userId: projectMembers.userId,
			role: projectMembers.role,
			name: users.name,
			email: users.email,
			avatarUrl: users.avatarUrl
		})
		.from(projectMembers)
		.innerJoin(users, eq(projectMembers.userId, users.id))
		.where(eq(projectMembers.projectId, projectId));

	return {
		project,
		columns: projectColumns,
		members
	};
};
