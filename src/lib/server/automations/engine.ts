import { db } from '$lib/server/db/index.js';
import {
	automationRules,
	automationExecutionLog,
	tasks,
	taskLabels,
	comments,
	notifications,
	webhookEndpoints,
	webhookDeliveries
} from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TriggerCondition {
	field: string;
	operator: string;
	value: unknown;
}

export interface AutomationAction {
	type: string;
	params: Record<string, unknown>;
}

export interface EventContext {
	projectId: string;
	taskId?: string;
	task?: Record<string, unknown>;
	changes?: Record<string, unknown>;
	userId?: string;
	[key: string]: unknown;
}

interface ActionResult {
	type: string;
	success: boolean;
	error?: string;
}

// ─── Condition Evaluation ────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	return path.split('.').reduce<unknown>((current, key) => {
		if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
			return (current as Record<string, unknown>)[key];
		}
		return undefined;
	}, obj);
}

function evaluateSingleCondition(condition: TriggerCondition, context: EventContext): boolean {
	const fieldValue = getNestedValue(context as unknown as Record<string, unknown>, condition.field);

	switch (condition.operator) {
		case 'equals':
			return fieldValue === condition.value;

		case 'not_equals':
			return fieldValue !== condition.value;

		case 'contains': {
			if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
				return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
			}
			if (Array.isArray(fieldValue)) {
				return fieldValue.includes(condition.value);
			}
			return false;
		}

		case 'gt':
			return typeof fieldValue === 'number' && typeof condition.value === 'number'
				&& fieldValue > condition.value;

		case 'lt':
			return typeof fieldValue === 'number' && typeof condition.value === 'number'
				&& fieldValue < condition.value;

		case 'gte':
			return typeof fieldValue === 'number' && typeof condition.value === 'number'
				&& fieldValue >= condition.value;

		case 'lte':
			return typeof fieldValue === 'number' && typeof condition.value === 'number'
				&& fieldValue <= condition.value;

		case 'in': {
			if (Array.isArray(condition.value)) {
				return condition.value.includes(fieldValue);
			}
			return false;
		}

		case 'not_in': {
			if (Array.isArray(condition.value)) {
				return !condition.value.includes(fieldValue);
			}
			return false;
		}

		case 'is_empty':
			return fieldValue === null || fieldValue === undefined || fieldValue === '';

		case 'is_not_empty':
			return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

		default:
			return false;
	}
}

export function evaluateConditions(conditions: TriggerCondition[], context: EventContext): boolean {
	if (conditions.length === 0) return true;
	return conditions.every((condition) => evaluateSingleCondition(condition, context));
}

// ─── Action Executors ────────────────────────────────────────────────────────

async function executeSetField(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { field, value } = params;
	if (!context.taskId || typeof field !== 'string') return;

	const updateData: Record<string, unknown> = {
		[field]: value,
		updatedAt: new Date().toISOString()
	};

	await db.update(tasks).set(updateData).where(eq(tasks.id, context.taskId));
}

async function executeAssignUser(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { userId } = params;
	if (!context.taskId || typeof userId !== 'string') return;

	await db
		.update(tasks)
		.set({ assigneeId: userId, updatedAt: new Date().toISOString() })
		.where(eq(tasks.id, context.taskId));
}

async function executeAddLabel(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { labelId } = params;
	if (!context.taskId || typeof labelId !== 'string') return;

	const existing = await db
		.select()
		.from(taskLabels)
		.where(and(eq(taskLabels.taskId, context.taskId), eq(taskLabels.labelId, labelId)))
		.limit(1);

	if (existing.length === 0) {
		await db.insert(taskLabels).values({ taskId: context.taskId, labelId });
	}
}

async function executeRemoveLabel(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { labelId } = params;
	if (!context.taskId || typeof labelId !== 'string') return;

	await db
		.delete(taskLabels)
		.where(and(eq(taskLabels.taskId, context.taskId), eq(taskLabels.labelId, labelId)));
}

async function executeMoveColumn(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { columnId } = params;
	if (!context.taskId || typeof columnId !== 'string') return;

	await db
		.update(tasks)
		.set({ columnId, updatedAt: new Date().toISOString() })
		.where(eq(tasks.id, context.taskId));
}

async function executeSetPriority(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { priority } = params;
	if (!context.taskId || typeof priority !== 'string') return;

	await db
		.update(tasks)
		.set({ priority: priority as 'none' | 'low' | 'medium' | 'high' | 'urgent', updatedAt: new Date().toISOString() })
		.where(eq(tasks.id, context.taskId));
}

async function executeSetStatus(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { status } = params;
	if (!context.taskId || typeof status !== 'string') return;

	const updateData: Record<string, unknown> = {
		status: status as 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled',
		updatedAt: new Date().toISOString()
	};

	if (status === 'done') {
		updateData.completedAt = new Date().toISOString();
	}

	await db.update(tasks).set(updateData).where(eq(tasks.id, context.taskId));
}

async function executeAddComment(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { body } = params;
	if (!context.taskId || typeof body !== 'string') return;

	const authorId = (typeof params.authorId === 'string' ? params.authorId : context.userId) ?? '';

	await db.insert(comments).values({
		taskId: context.taskId,
		authorId,
		body
	});
}

async function executeSendNotification(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { userId, title, body } = params;
	const targetUserId = typeof userId === 'string' ? userId : context.userId;

	if (!targetUserId || typeof title !== 'string') return;

	await db.insert(notifications).values({
		userId: targetUserId,
		type: 'automation',
		title,
		body: typeof body === 'string' ? body : null,
		linkUrl: context.taskId ? `/tasks/${context.taskId}` : null
	});
}

async function executeTriggerWebhook(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { url, webhookEndpointId } = params;

	if (typeof webhookEndpointId === 'string') {
		const [endpoint] = await db
			.select()
			.from(webhookEndpoints)
			.where(and(eq(webhookEndpoints.id, webhookEndpointId), eq(webhookEndpoints.isActive, true)))
			.limit(1);

		if (endpoint) {
			await db.insert(webhookDeliveries).values({
				endpointId: endpoint.id,
				event: 'automation.triggered',
				payload: { context, params },
				status: 'pending'
			});
		}
		return;
	}

	if (typeof url === 'string') {
		try {
			await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event: 'automation.triggered', data: context }),
				signal: AbortSignal.timeout(10000)
			});
		} catch {
			throw new Error(`Webhook request to ${url} failed`);
		}
	}
}

async function executeCreateSubtask(
	params: Record<string, unknown>,
	context: EventContext
): Promise<void> {
	const { title } = params;
	if (!context.taskId || typeof title !== 'string') return;

	const [parentTask] = await db
		.select()
		.from(tasks)
		.where(eq(tasks.id, context.taskId))
		.limit(1);

	if (!parentTask) return;

	const subtaskId = createId();
	const displayId = `${parentTask.displayId}-sub`;

	await db.insert(tasks).values({
		id: subtaskId,
		displayId,
		projectId: parentTask.projectId,
		columnId: parentTask.columnId,
		parentTaskId: context.taskId,
		title,
		description: typeof params.description === 'string' ? params.description : null,
		priority: typeof params.priority === 'string'
			? (params.priority as 'none' | 'low' | 'medium' | 'high' | 'urgent')
			: parentTask.priority,
		status: 'todo',
		assigneeId: typeof params.assigneeId === 'string' ? params.assigneeId : parentTask.assigneeId,
		reporterId: context.userId ?? parentTask.reporterId,
		position: 'a0'
	});
}

// ─── Action Dispatcher ───────────────────────────────────────────────────────

const actionExecutors: Record<
	string,
	(params: Record<string, unknown>, context: EventContext) => Promise<void>
> = {
	set_field: executeSetField,
	assign_user: executeAssignUser,
	add_label: executeAddLabel,
	remove_label: executeRemoveLabel,
	move_column: executeMoveColumn,
	set_priority: executeSetPriority,
	set_status: executeSetStatus,
	add_comment: executeAddComment,
	send_notification: executeSendNotification,
	trigger_webhook: executeTriggerWebhook,
	create_subtask: executeCreateSubtask
};

export async function executeActions(
	actions: AutomationAction[],
	context: EventContext
): Promise<ActionResult[]> {
	const results: ActionResult[] = [];

	for (const action of actions) {
		const executor = actionExecutors[action.type];
		if (!executor) {
			results.push({ type: action.type, success: false, error: `Unknown action type: ${action.type}` });
			continue;
		}

		try {
			await executor(action.params, context);
			results.push({ type: action.type, success: true });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			results.push({ type: action.type, success: false, error: message });
		}
	}

	return results;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function processEvent(
	projectId: string,
	event: string,
	eventData: EventContext
): Promise<void> {
	const rules = await db
		.select()
		.from(automationRules)
		.where(and(eq(automationRules.projectId, projectId), eq(automationRules.isActive, true)));

	const matchingRules = rules.filter((rule) => {
		const trigger = rule.trigger as { event: string; conditions: TriggerCondition[] };
		if (trigger.event !== event) return false;
		return evaluateConditions(trigger.conditions ?? [], eventData);
	});

	for (const rule of matchingRules) {
		const startTime = Date.now();
		const actions = rule.actions as AutomationAction[];

		const results = await executeActions(actions, eventData);

		const allSucceeded = results.every((r) => r.success);
		const allFailed = results.every((r) => !r.success);
		const status = allSucceeded ? 'success' : allFailed ? 'failure' : 'partial_failure';
		const durationMs = Date.now() - startTime;

		await db.insert(automationExecutionLog).values({
			ruleId: rule.id,
			triggerEvent: event,
			triggerData: eventData as Record<string, unknown>,
			actionsExecuted: results,
			status,
			durationMs
		});

		await db
			.update(automationRules)
			.set({
				executionCount: rule.executionCount + 1,
				lastExecutedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			})
			.where(eq(automationRules.id, rule.id));
	}
}
