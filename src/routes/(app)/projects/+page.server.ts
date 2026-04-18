import type { PageServerLoad, Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, projectMembers, columns } from '$lib/server/db/schema.js';
import { eq, or } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { checkProjectLimit } from '$lib/server/payments/guards.js';

const createProjectSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	description: z.string().max(500).optional()
});

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 50) +
		'-' +
		Date.now().toString(36)
	);
}

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const userProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			slug: projects.slug,
			description: projects.description,
			visibility: projects.visibility,
			createdAt: projects.createdAt,
			ownerId: projects.ownerId
		})
		.from(projects)
		.leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
		.where(or(eq(projects.ownerId, user.id), eq(projectMembers.userId, user.id)))
		.groupBy(projects.id)
		.orderBy(projects.createdAt);

	return { projects: userProjects };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const raw = {
			name: formData.get('name') as string,
			description: (formData.get('description') as string) || undefined
		};

		const result = createProjectSchema.safeParse(raw);
		if (!result.success) {
			return fail(400, { error: result.error.issues[0].message });
		}

		const canCreate = await checkProjectLimit(locals.user.id);
		if (!canCreate) {
			return fail(402, {
				error: 'Project limit reached. Upgrade your plan to create more projects.'
			});
		}

		const slug = slugify(result.data.name);

		const [project] = await db
			.insert(projects)
			.values({
				name: result.data.name,
				slug,
				description: result.data.description ?? null,
				ownerId: locals.user.id
			})
			.returning();

		await db.insert(projectMembers).values({
			projectId: project.id,
			userId: locals.user.id,
			role: 'owner'
		});

		const defaultColumns = [
			{ name: 'Backlog', position: 0, color: '#6b7280' },
			{ name: 'To Do', position: 1, color: '#3b82f6' },
			{ name: 'In Progress', position: 2, color: '#f59e0b' },
			{ name: 'In Review', position: 3, color: '#8b5cf6' },
			{ name: 'Done', position: 4, color: '#22c55e' }
		];

		for (const col of defaultColumns) {
			await db.insert(columns).values({
				projectId: project.id,
				name: col.name,
				position: col.position,
				color: col.color
			});
		}

		throw redirect(303, `/projects/${project.id}/board`);
	}
};
