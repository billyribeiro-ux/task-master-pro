import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { users, projects, tasks, projectMembers, fileAttachments } from '$lib/server/db/schema.js';
import { eq, count, inArray } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';

const PLAN_LIMITS = {
	free: {
		maxProjects: 3,
		maxTasks: 100,
		maxMembersPerProject: 5,
		maxFiles: 50,
		maxFileUploadMB: 10,
		maxStorageMB: 100
	},
	pro: {
		maxProjects: 50,
		maxTasks: 10_000,
		maxMembersPerProject: 50,
		maxFiles: 5_000,
		maxFileUploadMB: 100,
		maxStorageMB: 10_000
	},
	enterprise: {
		maxProjects: Infinity,
		maxTasks: Infinity,
		maxMembersPerProject: Infinity,
		maxFiles: Infinity,
		maxFileUploadMB: 500,
		maxStorageMB: 100_000
	}
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export function requirePlan(event: RequestEvent, allowedPlans: PlanName[]) {
	const user = requireAuth(event);
	if (!allowedPlans.includes(user.plan as PlanName)) {
		throw error(402, {
			message: `This feature requires one of the following plans: ${allowedPlans.join(', ')}`
		});
	}
	return user;
}

export function getPlanLimits(plan: PlanName) {
	return PLAN_LIMITS[plan];
}

export async function checkProjectLimit(userId: string): Promise<boolean> {
	const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (user.length === 0) return false;

	const plan = user[0].plan as PlanName;
	const limits = PLAN_LIMITS[plan];

	const [result] = await db
		.select({ total: count() })
		.from(projects)
		.where(eq(projects.ownerId, userId));

	return (result?.total ?? 0) < limits.maxProjects;
}

export async function checkFeatureLimit(
	userId: string,
	feature: 'projects' | 'tasks' | 'members' | 'fileUpload' | 'storage'
): Promise<{ allowed: boolean; limit: number; current: number }> {
	const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (user.length === 0) {
		return { allowed: false, limit: 0, current: 0 };
	}

	const plan = user[0].plan as PlanName;
	const limits = PLAN_LIMITS[plan];

	switch (feature) {
		case 'projects': {
			const [result] = await db
				.select({ total: count() })
				.from(projects)
				.where(eq(projects.ownerId, userId));
			const current = result?.total ?? 0;
			return { allowed: current < limits.maxProjects, limit: limits.maxProjects, current };
		}
		case 'tasks': {
			const userProjectIds = await db
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.ownerId, userId));

			if (userProjectIds.length === 0) {
				return { allowed: true, limit: limits.maxTasks, current: 0 };
			}

			const [taskCount] = await db
				.select({ total: count() })
				.from(tasks)
				.where(inArray(tasks.projectId, userProjectIds.map(p => p.id)));

			const current = taskCount?.total ?? 0;
			return { allowed: current < limits.maxTasks, limit: limits.maxTasks, current };
		}
		case 'members': {
			const userProjectIds = await db
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.ownerId, userId));

			if (userProjectIds.length === 0) {
				return { allowed: true, limit: limits.maxMembersPerProject, current: 0 };
			}

			const [memberCount] = await db
				.select({ total: count() })
				.from(projectMembers)
				.where(inArray(projectMembers.projectId, userProjectIds.map(p => p.id)));

			const current = memberCount?.total ?? 0;
			return { allowed: current < limits.maxMembersPerProject, limit: limits.maxMembersPerProject, current };
		}
		case 'fileUpload': {
			const userProjectIds = await db
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.ownerId, userId));

			if (userProjectIds.length === 0) {
				return { allowed: true, limit: limits.maxFiles, current: 0 };
			}

			const [fileCount] = await db
				.select({ total: count() })
				.from(fileAttachments)
				.where(inArray(fileAttachments.taskId,
					db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.projectId, userProjectIds.map(p => p.id)))
				));

			const current = fileCount?.total ?? 0;
			return { allowed: current < limits.maxFiles, limit: limits.maxFiles, current };
		}
		case 'storage': {
			const userProjectIds = await db
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.ownerId, userId));

			if (userProjectIds.length === 0) {
				return { allowed: true, limit: limits.maxStorageMB, current: 0 };
			}

			const [storageResult] = await db
				.select({ total: count() })
				.from(fileAttachments)
				.where(inArray(fileAttachments.taskId,
					db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.projectId, userProjectIds.map(p => p.id)))
				));

			const current = storageResult?.total ?? 0;
			return { allowed: current < limits.maxStorageMB, limit: limits.maxStorageMB, current };
		}
		default:
			return { allowed: false, limit: 0, current: 0 };
	}
}
