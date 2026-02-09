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
		maxStorageMB: 100,
		// Future features
		maxCustomFieldsPerProject: 3,
		maxAutomationRulesPerProject: 2,
		maxRecurringTasksPerProject: 3,
		maxWebhookEndpointsPerProject: 1,
		maxApiKeys: 1,
		maxGoals: 5,
		maxTemplates: 2,
		aiSuggestionsPerDay: 10,
		aiChatMessagesPerDay: 20,
		totpEnabled: false,
		customFieldsEnabled: true,
		automationsEnabled: false,
		recurringTasksEnabled: true,
		dependenciesEnabled: true,
		goalsEnabled: false,
		templatesEnabled: true,
		apiKeysEnabled: false,
		webhooksEnabled: false
	},
	pro: {
		maxProjects: 50,
		maxMembersPerProject: 50,
		maxFileUploadMB: 100,
		maxStorageMB: 10_000,
		// Future features
		maxCustomFieldsPerProject: 25,
		maxAutomationRulesPerProject: 25,
		maxRecurringTasksPerProject: 50,
		maxWebhookEndpointsPerProject: 10,
		maxApiKeys: 10,
		maxGoals: 100,
		maxTemplates: 25,
		aiSuggestionsPerDay: 100,
		aiChatMessagesPerDay: 200,
		totpEnabled: true,
		customFieldsEnabled: true,
		automationsEnabled: true,
		recurringTasksEnabled: true,
		dependenciesEnabled: true,
		goalsEnabled: true,
		templatesEnabled: true,
		apiKeysEnabled: true,
		webhooksEnabled: true
	},
	enterprise: {
		maxProjects: Infinity,
		maxMembersPerProject: Infinity,
		maxFileUploadMB: 500,
		maxStorageMB: 100_000,
		// Future features
		maxCustomFieldsPerProject: Infinity,
		maxAutomationRulesPerProject: Infinity,
		maxRecurringTasksPerProject: Infinity,
		maxWebhookEndpointsPerProject: Infinity,
		maxApiKeys: Infinity,
		maxGoals: Infinity,
		maxTemplates: Infinity,
		aiSuggestionsPerDay: Infinity,
		aiChatMessagesPerDay: Infinity,
		totpEnabled: true,
		customFieldsEnabled: true,
		automationsEnabled: true,
		recurringTasksEnabled: true,
		dependenciesEnabled: true,
		goalsEnabled: true,
		templatesEnabled: true,
		apiKeysEnabled: true,
		webhooksEnabled: true
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

export type FeatureFlag =
	| 'totpEnabled'
	| 'customFieldsEnabled'
	| 'automationsEnabled'
	| 'recurringTasksEnabled'
	| 'dependenciesEnabled'
	| 'goalsEnabled'
	| 'templatesEnabled'
	| 'apiKeysEnabled'
	| 'webhooksEnabled';

export function requireFeature(event: RequestEvent, feature: FeatureFlag) {
	const user = requireAuth(event);
	const plan = user.plan as PlanName;
	const limits = PLAN_LIMITS[plan];

	if (!limits[feature]) {
		throw error(402, {
			message: `The ${feature.replace('Enabled', '').replace(/([A-Z])/g, ' $1').trim()} feature requires a plan upgrade`
		});
	}

	return user;
}

export type QuantityLimit =
	| 'maxCustomFieldsPerProject'
	| 'maxAutomationRulesPerProject'
	| 'maxRecurringTasksPerProject'
	| 'maxWebhookEndpointsPerProject'
	| 'maxApiKeys'
	| 'maxGoals'
	| 'maxTemplates'
	| 'aiSuggestionsPerDay'
	| 'aiChatMessagesPerDay';

export function getQuantityLimit(plan: PlanName, limit: QuantityLimit): number {
	return PLAN_LIMITS[plan][limit];
}
