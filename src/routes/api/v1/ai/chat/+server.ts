import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { aiConversations, aiConversationMessages } from '$lib/server/db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { aiChatSchema } from '$lib/validation/ai.js';
import { chat } from '$lib/server/ai/engine.js';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = aiChatSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { projectId, conversationId, message, context } = result.data;
	await requireProjectAccess(event, projectId);

	let activeConversationId = conversationId;
	let conversationHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

	// If continuing an existing conversation, load its history
	if (activeConversationId) {
		const [conversation] = await db
			.select()
			.from(aiConversations)
			.where(eq(aiConversations.id, activeConversationId))
			.limit(1);

		if (!conversation) throw error(404, 'Conversation not found');

		if (conversation.projectId !== projectId) {
			throw error(400, 'Conversation does not belong to this project');
		}

		const existingMessages = await db
			.select()
			.from(aiConversationMessages)
			.where(eq(aiConversationMessages.conversationId, activeConversationId))
			.orderBy(asc(aiConversationMessages.createdAt));

		conversationHistory = existingMessages.map((m) => ({
			role: m.role as 'user' | 'assistant' | 'system',
			content: m.content
		}));
	} else {
		// Create a new conversation
		const [newConversation] = await db
			.insert(aiConversations)
			.values({
				projectId,
				userId: event.locals.user.id,
				title: message.slice(0, 100),
				context: context ? { taskIds: context.taskIds, scope: context.scope } : { scope: 'project' }
			})
			.returning();

		activeConversationId = newConversation.id;
	}

	// Save the user message
	const [userMessage] = await db
		.insert(aiConversationMessages)
		.values({
			conversationId: activeConversationId,
			role: 'user',
			content: message
		})
		.returning();

	// Call the AI engine
	let reply: string;
	let usage: { promptTokens: number; completionTokens: number } | undefined;

	try {
		const chatResult = await chat(
			projectId,
			message,
			conversationHistory,
			context ? { taskIds: context.taskIds, scope: context.scope } : undefined
		);
		reply = chatResult.reply;
		usage = chatResult.usage;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'AI chat failed';
		throw error(500, errorMessage);
	}

	// Save the assistant reply
	const [assistantMessage] = await db
		.insert(aiConversationMessages)
		.values({
			conversationId: activeConversationId,
			role: 'assistant',
			content: reply,
			tokenCount: usage ? usage.promptTokens + usage.completionTokens : null
		})
		.returning();

	// Update conversation timestamp
	await db
		.update(aiConversations)
		.set({ updatedAt: new Date().toISOString() })
		.where(eq(aiConversations.id, activeConversationId));

	return json(
		{
			conversationId: activeConversationId,
			message: {
				id: assistantMessage.id,
				role: assistantMessage.role,
				content: assistantMessage.content,
				createdAt: assistantMessage.createdAt
			},
			usage
		},
		{ status: 201 }
	);
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const projectId = event.url.searchParams.get('projectId');
	if (!projectId) throw error(400, 'projectId is required');

	await requireProjectAccess(event, projectId);

	const conversationId = event.url.searchParams.get('conversationId');

	if (conversationId) {
		// Get a specific conversation with messages
		const [conversation] = await db
			.select()
			.from(aiConversations)
			.where(eq(aiConversations.id, conversationId))
			.limit(1);

		if (!conversation) throw error(404, 'Conversation not found');

		if (conversation.projectId !== projectId) {
			throw error(400, 'Conversation does not belong to this project');
		}

		const messages = await db
			.select()
			.from(aiConversationMessages)
			.where(eq(aiConversationMessages.conversationId, conversationId))
			.orderBy(asc(aiConversationMessages.createdAt));

		return json({ ...conversation, messages });
	}

	// List conversations for the project
	const conversations = await db
		.select()
		.from(aiConversations)
		.where(eq(aiConversations.projectId, projectId))
		.orderBy(aiConversations.updatedAt)
		.limit(50);

	return json(conversations);
};
