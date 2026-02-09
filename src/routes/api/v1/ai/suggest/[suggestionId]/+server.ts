import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { aiSuggestions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { aiSuggestionActionSchema } from '$lib/validation/ai.js';

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { suggestionId } = event.params;

	const [existing] = await db
		.select()
		.from(aiSuggestions)
		.where(eq(aiSuggestions.id, suggestionId))
		.limit(1);

	if (!existing) throw error(404, 'Suggestion not found');

	await requireProjectAccess(event, existing.projectId);

	const body = await event.request.json();
	const result = aiSuggestionActionSchema.safeParse({ suggestionId, ...body });
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { action } = result.data;

	if (existing.status !== 'pending') {
		throw error(400, `Suggestion has already been ${existing.status}`);
	}

	const now = new Date().toISOString();
	const updateData: Record<string, unknown> =
		action === 'accept'
			? { status: 'accepted' as const, acceptedAt: now }
			: { status: 'dismissed' as const, dismissedAt: now };

	const [updated] = await db
		.update(aiSuggestions)
		.set(updateData)
		.where(eq(aiSuggestions.id, suggestionId))
		.returning();

	return json(updated);
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const { suggestionId } = event.params;

	const [suggestion] = await db
		.select()
		.from(aiSuggestions)
		.where(eq(aiSuggestions.id, suggestionId))
		.limit(1);

	if (!suggestion) throw error(404, 'Suggestion not found');

	await requireProjectAccess(event, suggestion.projectId);

	return json(suggestion);
};
