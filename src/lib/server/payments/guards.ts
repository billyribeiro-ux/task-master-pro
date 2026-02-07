import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { users, projects } from '$lib/server/db/schema.js';
import { eq, count } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';

const PLAN_LIMITS = {
	free: {
		maxProjects: 3,
		maxMembersPerProject: 5,
		maxFileUploadMB: 10,
		maxStorageMB: 100
	},
	pro: {
		maxProjects: 50,
		maxMembersPerProject: 50,
		maxFileUploadMB: 100,
		maxStorageMB: 10_000
	},
	enterprise: {
		maxProjects: Infinity,
		maxMembersPerProject: Infinity,
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
	feature: 'projects' | 'members' | 'fileUpload' | 'storage'
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
		default:
			return { allowed: true, limit: Infinity, current: 0 };
	}
}
