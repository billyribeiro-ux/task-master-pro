import { redirect, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { projectMembers } from '$lib/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import type { SessionUser } from './index.js';

interface EventWithLocals {
	locals: App.Locals;
}

export function requireAuth(event: EventWithLocals): SessionUser {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}
	return event.locals.user;
}

export function requireRole(event: EventWithLocals, roles: string[]): SessionUser {
	const user = requireAuth(event);
	if (!roles.includes(user.role)) {
		throw error(403, { message: 'Forbidden: insufficient role' });
	}
	return user;
}

export async function requireProjectAccess(
	event: EventWithLocals,
	projectId: string
): Promise<SessionUser> {
	const user = requireAuth(event);

	if (user.role === 'superadmin') {
		return user;
	}

	const membership = await db
		.select()
		.from(projectMembers)
		.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
		.limit(1);

	if (membership.length === 0) {
		throw error(403, { message: 'Forbidden: no access to this project' });
	}

	return user;
}

export async function requireProjectRole(
	event: EventWithLocals,
	projectId: string,
	roles: string[]
): Promise<SessionUser> {
	const user = requireAuth(event);

	if (user.role === 'superadmin') {
		return user;
	}

	const membership = await db
		.select()
		.from(projectMembers)
		.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
		.limit(1);

	if (membership.length === 0 || !roles.includes(membership[0].role)) {
		throw error(403, { message: 'Forbidden: insufficient project role' });
	}

	return user;
}
