import { db } from '$lib/server/db/index.js';
import {
	tasks,
	comments,
	timeEntries,
	projectMembers,
	labels,
	taskLabels,
	taskDependencies,
	users,
	columns
} from '$lib/server/db/schema.js';
import { eq, and, desc, sql, or, sum } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

// Default model for OpenAI-compatible providers; overridable via AI_MODEL.
const AI_MODEL = env.AI_MODEL ?? 'gpt-4o-mini';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiProviderResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
	};
}

export interface AiSuggestionResult {
	type: string;
	title: string;
	body: string;
	confidence: number;
	metadata: Record<string, unknown>;
}

interface CallAiOptions {
	temperature?: number;
	maxTokens?: number;
	responseFormat?: 'text' | 'json';
}

// ─── AI Provider Call ────────────────────────────────────────────────────────

async function callAiProvider(
	systemPrompt: string,
	userPrompt: string,
	options: CallAiOptions = {}
): Promise<AiProviderResponse> {
	const providerUrl = env.AI_PROVIDER_URL;
	const apiKey = env.AI_API_KEY;

	if (!providerUrl || !apiKey) {
		throw new Error('AI provider is not configured. Set AI_PROVIDER_URL and AI_API_KEY.');
	}

	const { temperature = 0.3, maxTokens = 2048, responseFormat = 'text' } = options;

	const response = await fetch(providerUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: AI_MODEL,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			temperature,
			max_tokens: maxTokens,
			...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
		})
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unknown error');
		throw new Error(`AI provider returned ${response.status}: ${errorBody}`);
	}

	const data = await response.json();

	// Support OpenAI-compatible response format
	const content = data.choices?.[0]?.message?.content ?? data.content ?? '';
	const usage = data.usage
		? {
				promptTokens: data.usage.prompt_tokens ?? 0,
				completionTokens: data.usage.completion_tokens ?? 0
			}
		: undefined;

	return { content, usage };
}

// ─── Helper: Fetch task with context ─────────────────────────────────────────

async function getTaskWithContext(projectId: string, taskId: string) {
	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
		.limit(1);

	if (!task) return null;

	const taskComments = await db
		.select()
		.from(comments)
		.where(eq(comments.taskId, taskId))
		.orderBy(desc(comments.createdAt))
		.limit(20);

	const taskTimeEntries = await db.select().from(timeEntries).where(eq(timeEntries.taskId, taskId));

	const taskLabelRows = await db
		.select({ name: labels.name })
		.from(taskLabels)
		.innerJoin(labels, eq(taskLabels.labelId, labels.id))
		.where(eq(taskLabels.taskId, taskId));

	const dependencies = await db
		.select()
		.from(taskDependencies)
		.where(or(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnTaskId, taskId)));

	const subtasks = await db.select().from(tasks).where(eq(tasks.parentTaskId, taskId));

	return {
		...task,
		comments: taskComments,
		timeEntries: taskTimeEntries,
		labels: taskLabelRows.map((l) => l.name),
		dependencies,
		subtasks
	};
}

// ─── Helper: Fetch project context ───────────────────────────────────────────

async function getProjectContext(projectId: string) {
	const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

	const members = await db
		.select({
			userId: projectMembers.userId,
			role: projectMembers.role,
			name: users.name,
			email: users.email
		})
		.from(projectMembers)
		.innerJoin(users, eq(projectMembers.userId, users.id))
		.where(eq(projectMembers.projectId, projectId));

	const projectLabels = await db.select().from(labels).where(eq(labels.projectId, projectId));

	const projectColumns = await db
		.select()
		.from(columns)
		.where(eq(columns.projectId, projectId))
		.orderBy(columns.position);

	return {
		tasks: projectTasks,
		members,
		labels: projectLabels,
		columns: projectColumns
	};
}

// ─── 1. Generate Task Breakdown ──────────────────────────────────────────────

export async function generateTaskBreakdown(
	projectId: string,
	taskId: string
): Promise<AiSuggestionResult> {
	const taskCtx = await getTaskWithContext(projectId, taskId);
	if (!taskCtx) throw new Error('Task not found');

	const systemPrompt = `You are a project management AI assistant. Analyze the given task and suggest a breakdown into smaller, actionable subtasks. Return JSON with the following structure:
{
  "subtasks": [{ "title": string, "description": string, "estimateMinutes": number, "priority": "low"|"medium"|"high" }],
  "reasoning": string
}`;

	const userPrompt = `Task: ${taskCtx.title}
Description: ${taskCtx.description ?? 'No description'}
Current Priority: ${taskCtx.priority}
Current Status: ${taskCtx.status}
Story Points: ${taskCtx.storyPoints ?? 'Not estimated'}
Labels: ${taskCtx.labels.join(', ') || 'None'}
Existing Subtasks: ${taskCtx.subtasks.map((s) => s.title).join(', ') || 'None'}
Comments: ${taskCtx.comments.map((c) => c.body).join('\n') || 'None'}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 2048
	});

	let parsed: { subtasks: unknown[]; reasoning: string };
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = { subtasks: [], reasoning: response.content };
	}

	return {
		type: 'task_breakdown',
		title: `Suggested breakdown for "${taskCtx.title}"`,
		body: parsed.reasoning ?? response.content,
		confidence: 0.8,
		metadata: {
			taskId,
			subtasks: parsed.subtasks ?? [],
			tokenUsage: response.usage
		}
	};
}

// ─── 2. Recommend Priority ───────────────────────────────────────────────────

export async function recommendPriority(
	projectId: string,
	taskId: string
): Promise<AiSuggestionResult> {
	const taskCtx = await getTaskWithContext(projectId, taskId);
	if (!taskCtx) throw new Error('Task not found');

	const projectCtx = await getProjectContext(projectId);

	const priorityDistribution = projectCtx.tasks.reduce(
		(acc, t) => {
			acc[t.priority] = (acc[t.priority] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const systemPrompt = `You are a project management AI. Analyze the task and project context, then recommend a priority level. Return JSON:
{
  "recommendedPriority": "none"|"low"|"medium"|"high"|"urgent",
  "confidence": number (0-1),
  "reasoning": string
}`;

	const userPrompt = `Task: ${taskCtx.title}
Description: ${taskCtx.description ?? 'No description'}
Current Priority: ${taskCtx.priority}
Due Date: ${taskCtx.dueDate ?? 'None'}
Labels: ${taskCtx.labels.join(', ') || 'None'}
Dependencies blocking this task: ${taskCtx.dependencies.filter((d) => d.dependsOnTaskId !== taskId).length}
Tasks blocked by this task: ${taskCtx.dependencies.filter((d) => d.taskId !== taskId).length}

Project Priority Distribution: ${JSON.stringify(priorityDistribution)}
Total Project Tasks: ${projectCtx.tasks.length}
Overdue Tasks: ${projectCtx.tasks.filter((t) => t.dueDate && t.dueDate < new Date().toISOString() && t.status !== 'done').length}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 1024
	});

	let parsed: { recommendedPriority: string; confidence: number; reasoning: string };
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = { recommendedPriority: 'medium', confidence: 0.5, reasoning: response.content };
	}

	return {
		type: 'priority_recommendation',
		title: `Priority recommendation for "${taskCtx.title}"`,
		body: parsed.reasoning,
		confidence: parsed.confidence ?? 0.7,
		metadata: {
			taskId,
			currentPriority: taskCtx.priority,
			recommendedPriority: parsed.recommendedPriority,
			tokenUsage: response.usage
		}
	};
}

// ─── 3. Recommend Assignee ───────────────────────────────────────────────────

export async function recommendAssignee(
	projectId: string,
	taskId: string
): Promise<AiSuggestionResult> {
	const taskCtx = await getTaskWithContext(projectId, taskId);
	if (!taskCtx) throw new Error('Task not found');

	const projectCtx = await getProjectContext(projectId);

	// Calculate workload per member
	const workload = projectCtx.members.map((member) => {
		const memberTasks = projectCtx.tasks.filter(
			(t) => t.assigneeId === member.userId && t.status !== 'done' && t.status !== 'cancelled'
		);
		return {
			userId: member.userId,
			name: member.name,
			role: member.role,
			activeTaskCount: memberTasks.length,
			totalStoryPoints: memberTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
		};
	});

	// Find members who have worked on similar tasks (by labels)
	const systemPrompt = `You are a project management AI. Based on team workload and task context, recommend the best assignee. Return JSON:
{
  "recommendedUserId": string,
  "recommendedUserName": string,
  "confidence": number (0-1),
  "reasoning": string
}`;

	const userPrompt = `Task to assign: ${taskCtx.title}
Description: ${taskCtx.description ?? 'No description'}
Labels: ${taskCtx.labels.join(', ') || 'None'}
Priority: ${taskCtx.priority}
Story Points: ${taskCtx.storyPoints ?? 'Not estimated'}

Team Workload:
${workload.map((w) => `- ${w.name} (${w.role}): ${w.activeTaskCount} active tasks, ${w.totalStoryPoints} story points`).join('\n')}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 1024
	});

	let parsed: {
		recommendedUserId: string;
		recommendedUserName: string;
		confidence: number;
		reasoning: string;
	};
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			recommendedUserId: '',
			recommendedUserName: 'Unknown',
			confidence: 0.5,
			reasoning: response.content
		};
	}

	return {
		type: 'assignee_recommendation',
		title: `Assignee recommendation for "${taskCtx.title}"`,
		body: parsed.reasoning,
		confidence: parsed.confidence ?? 0.7,
		metadata: {
			taskId,
			recommendedUserId: parsed.recommendedUserId,
			recommendedUserName: parsed.recommendedUserName,
			workloadSnapshot: workload,
			tokenUsage: response.usage
		}
	};
}

// ─── 4. Detect Duplicates ────────────────────────────────────────────────────

export async function detectDuplicates(
	projectId: string,
	title: string,
	description?: string
): Promise<AiSuggestionResult> {
	const projectTasks = await db
		.select({
			id: tasks.id,
			displayId: tasks.displayId,
			title: tasks.title,
			description: tasks.description,
			status: tasks.status
		})
		.from(tasks)
		.where(eq(tasks.projectId, projectId));

	if (projectTasks.length === 0) {
		return {
			type: 'duplicate_detection',
			title: 'Duplicate check complete',
			body: 'No existing tasks to compare against.',
			confidence: 1.0,
			metadata: { duplicates: [] }
		};
	}

	const systemPrompt = `You are a duplicate detection AI. Compare the new task against existing tasks and identify potential duplicates or closely related tasks. Return JSON:
{
  "duplicates": [{ "taskId": string, "displayId": string, "title": string, "similarity": number (0-1), "reason": string }],
  "hasDuplicate": boolean,
  "reasoning": string
}`;

	const existingTaskList = projectTasks
		.map((t) => `[${t.displayId}] ${t.title} (${t.status}) - ${t.description ?? 'No description'}`)
		.join('\n');

	const userPrompt = `New task title: ${title}
New task description: ${description ?? 'No description'}

Existing tasks:
${existingTaskList}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 2048
	});

	let parsed: {
		duplicates: {
			taskId: string;
			displayId: string;
			title: string;
			similarity: number;
			reason: string;
		}[];
		hasDuplicate: boolean;
		reasoning: string;
	};
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = { duplicates: [], hasDuplicate: false, reasoning: response.content };
	}

	return {
		type: 'duplicate_detection',
		title: parsed.hasDuplicate
			? `Potential duplicates found for "${title}"`
			: `No duplicates found for "${title}"`,
		body: parsed.reasoning,
		confidence: parsed.hasDuplicate ? 0.85 : 0.95,
		metadata: {
			inputTitle: title,
			inputDescription: description,
			duplicates: parsed.duplicates ?? [],
			tokenUsage: response.usage
		}
	};
}

// ─── 5. Estimate Effort ──────────────────────────────────────────────────────

export async function estimateEffort(
	projectId: string,
	taskId: string
): Promise<AiSuggestionResult> {
	const taskCtx = await getTaskWithContext(projectId, taskId);
	if (!taskCtx) throw new Error('Task not found');

	// Get completed tasks with time data for reference
	const completedTasks = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			description: tasks.description,
			storyPoints: tasks.storyPoints,
			estimateMinutes: tasks.estimateMinutes,
			priority: tasks.priority
		})
		.from(tasks)
		.where(and(eq(tasks.projectId, projectId), eq(tasks.status, 'done')))
		.limit(50);

	// Get actual time spent on completed tasks
	const completedTaskIds = completedTasks.map((t) => t.id);
	let timeData: { taskId: string; totalSeconds: number }[] = [];
	if (completedTaskIds.length > 0) {
		const timeRows = await db
			.select({
				taskId: timeEntries.taskId,
				totalSeconds: sum(timeEntries.durationSeconds)
			})
			.from(timeEntries)
			.where(
				sql`${timeEntries.taskId} IN (${sql.join(
					completedTaskIds.map((id) => sql`${id}`),
					sql`, `
				)})`
			)
			.groupBy(timeEntries.taskId);

		timeData = timeRows.map((r) => ({
			taskId: r.taskId,
			totalSeconds: Number(r.totalSeconds) || 0
		}));
	}

	const systemPrompt = `You are a project estimation AI. Based on the task details and historical data from similar completed tasks, estimate the effort required. Return JSON:
{
  "storyPoints": number (1, 2, 3, 5, 8, 13, 21),
  "estimateMinutes": number,
  "confidence": number (0-1),
  "reasoning": string,
  "similarTasks": [{ "title": string, "storyPoints": number, "actualMinutes": number }]
}`;

	const referenceTasks = completedTasks.map((t) => {
		const time = timeData.find((td) => td.taskId === t.id);
		return `- ${t.title} | Points: ${t.storyPoints ?? 'N/A'} | Estimate: ${t.estimateMinutes ?? 'N/A'}min | Actual: ${time ? Math.round(time.totalSeconds / 60) : 'N/A'}min`;
	});

	const userPrompt = `Task to estimate: ${taskCtx.title}
Description: ${taskCtx.description ?? 'No description'}
Priority: ${taskCtx.priority}
Labels: ${taskCtx.labels.join(', ') || 'None'}
Subtasks: ${taskCtx.subtasks.length}

Historical completed tasks for reference:
${referenceTasks.join('\n') || 'No historical data available'}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 1024
	});

	let parsed: {
		storyPoints: number;
		estimateMinutes: number;
		confidence: number;
		reasoning: string;
		similarTasks: unknown[];
	};
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			storyPoints: 3,
			estimateMinutes: 120,
			confidence: 0.5,
			reasoning: response.content,
			similarTasks: []
		};
	}

	return {
		type: 'effort_estimate',
		title: `Effort estimate for "${taskCtx.title}"`,
		body: parsed.reasoning,
		confidence: parsed.confidence ?? 0.7,
		metadata: {
			taskId,
			storyPoints: parsed.storyPoints,
			estimateMinutes: parsed.estimateMinutes,
			similarTasks: parsed.similarTasks ?? [],
			historicalTaskCount: completedTasks.length,
			tokenUsage: response.usage
		}
	};
}

// ─── 6. Analyze Blockers ────────────────────────────────────────────────────

export async function analyzeBlockers(projectId: string): Promise<AiSuggestionResult> {
	const projectCtx = await getProjectContext(projectId);

	const allDependencies = await db
		.select()
		.from(taskDependencies)
		.where(
			sql`${taskDependencies.taskId} IN (${sql.join(
				projectCtx.tasks.map((t) => sql`${t.id}`),
				sql`, `
			)})`
		);

	// Identify blocked tasks
	const blockedTasks = projectCtx.tasks.filter((task) => {
		const blockingDeps = allDependencies.filter(
			(d) => d.taskId === task.id && (d.type === 'is_blocked_by' || d.type === 'blocks')
		);
		return blockingDeps.length > 0 && task.status !== 'done' && task.status !== 'cancelled';
	});

	// Identify overdue tasks
	const now = new Date().toISOString();
	const overdueTasks = projectCtx.tasks.filter(
		(t) => t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'
	);

	// Tasks stuck in progress for too long (no updates)
	const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const staleTasks = projectCtx.tasks.filter(
		(t) => t.status === 'in_progress' && t.updatedAt < staleThreshold
	);

	const systemPrompt = `You are a project management AI analyst. Analyze the project for bottlenecks, blockers, and risks. Return JSON:
{
  "blockers": [{ "taskId": string, "title": string, "issue": string, "severity": "low"|"medium"|"high"|"critical", "suggestion": string }],
  "bottlenecks": [{ "area": string, "description": string, "affectedTaskCount": number }],
  "riskLevel": "low"|"medium"|"high",
  "summary": string,
  "recommendations": string[]
}`;

	const statusCounts = projectCtx.tasks.reduce(
		(acc, t) => {
			acc[t.status] = (acc[t.status] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const userPrompt = `Project Status Overview:
Task Distribution: ${JSON.stringify(statusCounts)}
Total Tasks: ${projectCtx.tasks.length}
Team Members: ${projectCtx.members.length}

Blocked Tasks (${blockedTasks.length}):
${blockedTasks.map((t) => `- [${t.displayId}] ${t.title} (${t.status})`).join('\n') || 'None'}

Overdue Tasks (${overdueTasks.length}):
${overdueTasks.map((t) => `- [${t.displayId}] ${t.title} - Due: ${t.dueDate}`).join('\n') || 'None'}

Stale In-Progress Tasks (${staleTasks.length}):
${staleTasks.map((t) => `- [${t.displayId}] ${t.title} - Last updated: ${t.updatedAt}`).join('\n') || 'None'}

Dependencies: ${allDependencies.length} total
Columns: ${projectCtx.columns.map((c) => `${c.name} (WIP limit: ${c.wipLimit ?? 'none'})`).join(', ')}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 2048
	});

	let parsed: {
		blockers: unknown[];
		bottlenecks: unknown[];
		riskLevel: string;
		summary: string;
		recommendations: string[];
	};
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			blockers: [],
			bottlenecks: [],
			riskLevel: 'medium',
			summary: response.content,
			recommendations: []
		};
	}

	return {
		type: 'blockers_analysis',
		title: 'Project blockers and bottleneck analysis',
		body: parsed.summary,
		confidence: 0.75,
		metadata: {
			blockers: parsed.blockers ?? [],
			bottlenecks: parsed.bottlenecks ?? [],
			riskLevel: parsed.riskLevel,
			recommendations: parsed.recommendations ?? [],
			overdue: overdueTasks.length,
			blocked: blockedTasks.length,
			stale: staleTasks.length,
			tokenUsage: response.usage
		}
	};
}

// ─── 7. Generate Project Summary ─────────────────────────────────────────────

export async function generateProjectSummary(projectId: string): Promise<AiSuggestionResult> {
	const projectCtx = await getProjectContext(projectId);

	const now = new Date().toISOString();
	const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

	const recentlyCompleted = projectCtx.tasks.filter(
		(t) => t.completedAt && t.completedAt >= oneWeekAgo
	);

	const statusCounts = projectCtx.tasks.reduce(
		(acc, t) => {
			acc[t.status] = (acc[t.status] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const priorityCounts = projectCtx.tasks.reduce(
		(acc, t) => {
			acc[t.priority] = (acc[t.priority] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const overdueTasks = projectCtx.tasks.filter(
		(t) => t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'
	);

	const unassignedTasks = projectCtx.tasks.filter(
		(t) => !t.assigneeId && t.status !== 'done' && t.status !== 'cancelled'
	);

	const systemPrompt = `You are a project management AI. Generate a concise but comprehensive project status summary. Return JSON:
{
  "summary": string,
  "highlights": string[],
  "concerns": string[],
  "velocity": string,
  "healthScore": number (0-100),
  "nextSteps": string[]
}`;

	const userPrompt = `Project Statistics:
Total Tasks: ${projectCtx.tasks.length}
Status Distribution: ${JSON.stringify(statusCounts)}
Priority Distribution: ${JSON.stringify(priorityCounts)}
Team Size: ${projectCtx.members.length}

Tasks Completed This Week: ${recentlyCompleted.length}
Overdue Tasks: ${overdueTasks.length}
Unassigned Active Tasks: ${unassignedTasks.length}

Columns: ${projectCtx.columns.map((c) => c.name).join(' -> ')}
Labels in Use: ${projectCtx.labels.map((l) => l.name).join(', ') || 'None'}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 2048
	});

	let parsed: {
		summary: string;
		highlights: string[];
		concerns: string[];
		velocity: string;
		healthScore: number;
		nextSteps: string[];
	};
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			summary: response.content,
			highlights: [],
			concerns: [],
			velocity: 'Unknown',
			healthScore: 50,
			nextSteps: []
		};
	}

	return {
		type: 'summary',
		title: 'Project status summary',
		body: parsed.summary,
		confidence: 0.85,
		metadata: {
			highlights: parsed.highlights ?? [],
			concerns: parsed.concerns ?? [],
			velocity: parsed.velocity,
			healthScore: parsed.healthScore,
			nextSteps: parsed.nextSteps ?? [],
			stats: {
				total: projectCtx.tasks.length,
				statusCounts,
				priorityCounts,
				completedThisWeek: recentlyCompleted.length,
				overdue: overdueTasks.length,
				unassigned: unassignedTasks.length
			},
			tokenUsage: response.usage
		}
	};
}

// ─── 8. Parse Natural Language Task ──────────────────────────────────────────

export async function parseNaturalLanguageTask(
	projectId: string,
	input: string
): Promise<{
	title: string;
	description: string | null;
	priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
	dueDate: string | null;
	labels: string[];
	storyPoints: number | null;
	estimateMinutes: number | null;
	assigneeName: string | null;
}> {
	const projectCtx = await getProjectContext(projectId);

	const systemPrompt = `You are a task parsing AI. Parse natural language input into a structured task. Use the project context to match labels and assignees. Return JSON:
{
  "title": string,
  "description": string | null,
  "priority": "none"|"low"|"medium"|"high"|"urgent",
  "dueDate": string (ISO date) | null,
  "labels": string[],
  "storyPoints": number | null,
  "estimateMinutes": number | null,
  "assigneeName": string | null
}

Today's date is ${new Date().toISOString().split('T')[0]}.`;

	const userPrompt = `Input: "${input}"

Available labels: ${projectCtx.labels.map((l) => l.name).join(', ') || 'None'}
Team members: ${projectCtx.members.map((m) => m.name).join(', ') || 'None'}`;

	const response = await callAiProvider(systemPrompt, userPrompt, {
		responseFormat: 'json',
		maxTokens: 1024,
		temperature: 0.1
	});

	let parsed: {
		title: string;
		description: string | null;
		priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
		dueDate: string | null;
		labels: string[];
		storyPoints: number | null;
		estimateMinutes: number | null;
		assigneeName: string | null;
	};
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			title: input,
			description: null,
			priority: 'none',
			dueDate: null,
			labels: [],
			storyPoints: null,
			estimateMinutes: null,
			assigneeName: null
		};
	}

	return {
		title: parsed.title || input,
		description: parsed.description ?? null,
		priority: parsed.priority ?? 'none',
		dueDate: parsed.dueDate ?? null,
		labels: parsed.labels ?? [],
		storyPoints: parsed.storyPoints ?? null,
		estimateMinutes: parsed.estimateMinutes ?? null,
		assigneeName: parsed.assigneeName ?? null
	};
}

// ─── Chat with AI ────────────────────────────────────────────────────────────

export async function chat(
	projectId: string,
	message: string,
	conversationHistory: { role: 'user' | 'assistant' | 'system'; content: string }[],
	context?: { taskIds?: string[]; scope: 'project' | 'task' | 'global' }
): Promise<{ reply: string; usage?: AiProviderResponse['usage'] }> {
	const projectCtx = await getProjectContext(projectId);

	// If specific tasks are referenced, fetch them
	let taskContext = '';
	if (context?.taskIds && context.taskIds.length > 0) {
		const referencedTasks = await db
			.select()
			.from(tasks)
			.where(
				sql`${tasks.id} IN (${sql.join(
					context.taskIds.map((id) => sql`${id}`),
					sql`, `
				)})`
			);
		taskContext = `\nReferenced Tasks:\n${referencedTasks.map((t) => `- [${t.displayId}] ${t.title} (${t.status}, ${t.priority}) - ${t.description ?? 'No description'}`).join('\n')}`;
	}

	const statusCounts = projectCtx.tasks.reduce(
		(acc, t) => {
			acc[t.status] = (acc[t.status] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const systemPrompt = `You are an AI assistant for a project management tool called TaskMaster Pro. You help users understand their project status, manage tasks, and make decisions.

Project Context:
- Total Tasks: ${projectCtx.tasks.length}
- Status Distribution: ${JSON.stringify(statusCounts)}
- Team Members: ${projectCtx.members.map((m) => m.name).join(', ')}
- Columns: ${projectCtx.columns.map((c) => c.name).join(' -> ')}
${taskContext}

Be concise, actionable, and helpful. Reference specific tasks by their display ID when possible.`;

	const providerUrl = env.AI_PROVIDER_URL;
	const apiKey = env.AI_API_KEY;

	if (!providerUrl || !apiKey) {
		throw new Error('AI provider is not configured. Set AI_PROVIDER_URL and AI_API_KEY.');
	}

	const messages = [
		{ role: 'system' as const, content: systemPrompt },
		...conversationHistory,
		{ role: 'user' as const, content: message }
	];

	const response = await fetch(providerUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: AI_MODEL,
			messages,
			temperature: 0.5,
			max_tokens: 2048
		})
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unknown error');
		throw new Error(`AI provider returned ${response.status}: ${errorBody}`);
	}

	const data = await response.json();
	const content = data.choices?.[0]?.message?.content ?? data.content ?? '';
	const usage = data.usage
		? {
				promptTokens: data.usage.prompt_tokens ?? 0,
				completionTokens: data.usage.completion_tokens ?? 0
			}
		: undefined;

	return { reply: content, usage };
}
