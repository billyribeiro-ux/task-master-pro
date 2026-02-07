import type { PageServerLoad, Actions } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { projects, projectMembers, users } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireProjectRole } from '$lib/server/auth/guards.js';

const updateProjectSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	visibility: z.enum(['private', 'team', 'public']).optional()
});

export const load: PageServerLoad = async ({ parent }) => {
	const { project, members } = await parent();

	return { project, members };
};

export const actions: Actions = {
	update: async (event) => {
		const { projectId } = event.params;
		await requireProjectRole(event, projectId, ['owner', 'admin']);

		const formData = await event.request.formData();
		const raw = {
			name: (formData.get('name') as string) || undefined,
			description: (formData.get('description') as string) || undefined,
			visibility: (formData.get('visibility') as string) || undefined
		};

		const result = updateProjectSchema.safeParse(raw);
		if (!result.success) {
			return fail(400, { error: result.error.issues[0].message });
		}

		const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		if (result.data.name) updates.name = result.data.name;
		if (result.data.description !== undefined) updates.description = result.data.description;
		if (result.data.visibility) updates.visibility = result.data.visibility;

		await db.update(projects).set(updates).where(eq(projects.id, projectId));

		return { success: true };
	},

	invite: async (event) => {
		const { projectId } = event.params;
		await requireProjectRole(event, projectId, ['owner', 'admin']);

		const formData = await event.request.formData();
		const email = formData.get('email') as string;
		const role = (formData.get('role') as string) ?? 'member';

		if (!email) return fail(400, { error: 'Email is required' });

		const [user] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (!user) {
			return fail(404, { error: 'User not found. They must have an account first.' });
		}

		const existing = await db
			.select()
			.from(projectMembers)
			.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
			.limit(1);

		if (existing.length > 0) {
			return fail(400, { error: 'User is already a member of this project' });
		}

		await db.insert(projectMembers).values({
			projectId,
			userId: user.id,
			role: role as 'owner' | 'admin' | 'member' | 'viewer'
		});

		return { success: true, invited: email };
	}
};
