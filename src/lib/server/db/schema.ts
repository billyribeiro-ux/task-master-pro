import { sqliteTable, text, integer, real, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable(
	'users',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		email: text('email').notNull(),
		name: text('name').notNull(),
		avatarUrl: text('avatar_url'),
		passwordHash: text('password_hash'),
		role: text('role', { enum: ['user', 'admin', 'superadmin'] })
			.notNull()
			.default('user'),
		plan: text('plan', { enum: ['free', 'pro', 'enterprise'] })
			.notNull()
			.default('free'),
		stripeCustomerId: text('stripe_customer_id'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		uniqueIndex('users_email_idx').on(table.email),
		index('users_stripe_customer_idx').on(table.stripeCustomerId)
	]
);

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('sessions_user_id_idx').on(table.userId)]
);

// ─── OAuth Accounts ──────────────────────────────────────────────────────────

export const oauthAccounts = sqliteTable(
	'oauth_accounts',
	{
		providerId: text('provider_id').notNull(),
		providerUserId: text('provider_user_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.providerId, table.providerUserId] }),
		index('oauth_accounts_user_id_idx').on(table.userId)
	]
);

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable(
	'projects',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		visibility: text('visibility', { enum: ['private', 'public', 'team'] })
			.notNull()
			.default('private'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		uniqueIndex('projects_slug_idx').on(table.slug),
		index('projects_owner_id_idx').on(table.ownerId)
	]
);

// ─── Project Members ─────────────────────────────────────────────────────────

export const projectMembers = sqliteTable(
	'project_members',
	{
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['viewer', 'member', 'admin', 'owner'] })
			.notNull()
			.default('member')
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.userId] }),
		index('project_members_user_id_idx').on(table.userId)
	]
);

// ─── Columns (Board Columns) ────────────────────────────────────────────────

export const columns = sqliteTable(
	'columns',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		position: integer('position').notNull().default(0),
		color: text('color').default('#6366f1'),
		wipLimit: integer('wip_limit')
	},
	(table) => [index('columns_project_id_idx').on(table.projectId)]
);

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
	'tasks',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		displayId: text('display_id').notNull(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		columnId: text('column_id')
			.notNull()
			.references(() => columns.id, { onDelete: 'cascade' }),
		parentTaskId: text('parent_task_id'),
		title: text('title').notNull(),
		description: text('description'),
		priority: text('priority', { enum: ['none', 'low', 'medium', 'high', 'urgent'] })
			.notNull()
			.default('none'),
		status: text('status', {
			enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']
		})
			.notNull()
			.default('todo'),
		assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		reporterId: text('reporter_id')
			.notNull()
			.references(() => users.id),
		position: text('position').notNull().default('a0'),
		dueDate: text('due_date'),
		estimateMinutes: integer('estimate_minutes'),
		storyPoints: integer('story_points'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		completedAt: text('completed_at')
	},
	(table) => [
		index('tasks_project_id_idx').on(table.projectId),
		index('tasks_column_id_idx').on(table.columnId),
		index('tasks_assignee_id_idx').on(table.assigneeId),
		index('tasks_reporter_id_idx').on(table.reporterId),
		index('tasks_parent_task_id_idx').on(table.parentTaskId),
		uniqueIndex('tasks_display_id_project_idx').on(table.displayId, table.projectId)
	]
);

// ─── Labels ──────────────────────────────────────────────────────────────────

export const labels = sqliteTable(
	'labels',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color').notNull().default('#6366f1')
	},
	(table) => [index('labels_project_id_idx').on(table.projectId)]
);

// ─── Task Labels (Junction) ─────────────────────────────────────────────────

export const taskLabels = sqliteTable(
	'task_labels',
	{
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		labelId: text('label_id')
			.notNull()
			.references(() => labels.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.taskId, table.labelId] })]
);

// ─── Comments ────────────────────────────────────────────────────────────────

export const comments = sqliteTable(
	'comments',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('comments_task_id_idx').on(table.taskId),
		index('comments_author_id_idx').on(table.authorId)
	]
);

// ─── Time Entries ────────────────────────────────────────────────────────────

export const timeEntries = sqliteTable(
	'time_entries',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		startedAt: text('started_at').notNull(),
		stoppedAt: text('stopped_at'),
		durationSeconds: integer('duration_seconds'),
		note: text('note')
	},
	(table) => [
		index('time_entries_task_id_idx').on(table.taskId),
		index('time_entries_user_id_idx').on(table.userId)
	]
);

// ─── File Attachments ────────────────────────────────────────────────────────

export const fileAttachments = sqliteTable(
	'file_attachments',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		uploaderId: text('uploader_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		fileSize: integer('file_size').notNull(),
		mimeType: text('mime_type').notNull(),
		s3Key: text('s3_key').notNull(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [index('file_attachments_task_id_idx').on(table.taskId)]
);

// ─── Activity Log ────────────────────────────────────────────────────────────

export const activityLog = sqliteTable(
	'activity_log',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		taskId: text('task_id'),
		actorId: text('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		action: text('action').notNull(),
		metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('activity_log_project_id_idx').on(table.projectId),
		index('activity_log_task_id_idx').on(table.taskId),
		index('activity_log_actor_id_idx').on(table.actorId)
	]
);

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = sqliteTable(
	'notifications',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		linkUrl: text('link_url'),
		isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('notifications_user_id_idx').on(table.userId),
		index('notifications_is_read_idx').on(table.userId, table.isRead)
	]
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUTURE FEATURES (2026-2036) ─ Forward-looking infrastructure
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Two-Factor Authentication (TOTP) ────────────────────────────────────

export const userTotpCredentials = sqliteTable(
	'user_totp_credentials',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		secret: text('secret').notNull(),
		verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [uniqueIndex('user_totp_user_id_idx').on(table.userId)]
);

export const userRecoveryCodes = sqliteTable(
	'user_recovery_codes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		codeHash: text('code_hash').notNull(),
		usedAt: text('used_at')
	},
	(table) => [index('user_recovery_codes_user_id_idx').on(table.userId)]
);

// ─── 2. API Keys & Developer Platform ──────────────────────────────────────

export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		keyHash: text('key_hash').notNull(),
		keyPrefix: text('key_prefix').notNull(),
		scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
		lastUsedAt: text('last_used_at'),
		expiresAt: text('expires_at'),
		revokedAt: text('revoked_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('api_keys_user_id_idx').on(table.userId),
		uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
		index('api_keys_key_prefix_idx').on(table.keyPrefix)
	]
);

// ─── 3. Outgoing Webhooks ───────────────────────────────────────────────────

export const webhookEndpoints = sqliteTable(
	'webhook_endpoints',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		secret: text('secret').notNull(),
		events: text('events', { mode: 'json' }).$type<string[]>().notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		failureCount: integer('failure_count').notNull().default(0),
		lastTriggeredAt: text('last_triggered_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('webhook_endpoints_project_id_idx').on(table.projectId),
		index('webhook_endpoints_active_idx').on(table.isActive)
	]
);

export const webhookDeliveries = sqliteTable(
	'webhook_deliveries',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		endpointId: text('endpoint_id')
			.notNull()
			.references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
		event: text('event').notNull(),
		payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		responseStatus: integer('response_status'),
		responseBody: text('response_body'),
		attemptCount: integer('attempt_count').notNull().default(1),
		status: text('status', { enum: ['pending', 'delivered', 'failed'] })
			.notNull()
			.default('pending'),
		nextRetryAt: text('next_retry_at'),
		deliveredAt: text('delivered_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('webhook_deliveries_endpoint_id_idx').on(table.endpointId),
		index('webhook_deliveries_status_idx').on(table.status),
		index('webhook_deliveries_next_retry_idx').on(table.nextRetryAt)
	]
);

// ─── 4. Task Dependencies ───────────────────────────────────────────────────

export const taskDependencies = sqliteTable(
	'task_dependencies',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		dependsOnTaskId: text('depends_on_task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		type: text('type', {
			enum: ['blocks', 'is_blocked_by', 'relates_to', 'duplicates']
		})
			.notNull()
			.default('blocks'),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('task_deps_task_id_idx').on(table.taskId),
		index('task_deps_depends_on_idx').on(table.dependsOnTaskId),
		uniqueIndex('task_deps_unique_pair_idx').on(table.taskId, table.dependsOnTaskId)
	]
);

// ─── 5. Recurring Tasks ────────────────────────────────────────────────────

export const recurringTaskRules = sqliteTable(
	'recurring_task_rules',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id),
		title: text('title').notNull(),
		description: text('description'),
		columnId: text('column_id')
			.notNull()
			.references(() => columns.id, { onDelete: 'cascade' }),
		assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		priority: text('priority', { enum: ['none', 'low', 'medium', 'high', 'urgent'] })
			.notNull()
			.default('none'),
		storyPoints: integer('story_points'),
		estimateMinutes: integer('estimate_minutes'),
		labelIds: text('label_ids', { mode: 'json' }).$type<string[]>(),
		rrule: text('rrule').notNull(),
		timezone: text('timezone').notNull().default('UTC'),
		lastGeneratedAt: text('last_generated_at'),
		nextOccurrenceAt: text('next_occurrence_at'),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		endsAt: text('ends_at'),
		maxOccurrences: integer('max_occurrences'),
		occurrenceCount: integer('occurrence_count').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('recurring_rules_project_id_idx').on(table.projectId),
		index('recurring_rules_next_occurrence_idx').on(table.nextOccurrenceAt),
		index('recurring_rules_active_idx').on(table.isActive)
	]
);

// ─── 6. Custom Fields ──────────────────────────────────────────────────────

export const customFieldDefinitions = sqliteTable(
	'custom_field_definitions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		fieldType: text('field_type', {
			enum: ['text', 'number', 'date', 'select', 'multi_select', 'url', 'email', 'checkbox', 'currency']
		}).notNull(),
		description: text('description'),
		isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(false),
		options: text('options', { mode: 'json' }).$type<{ label: string; value: string; color?: string }[]>(),
		defaultValue: text('default_value'),
		position: integer('position').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('custom_fields_project_id_idx').on(table.projectId),
		uniqueIndex('custom_fields_project_slug_idx').on(table.projectId, table.slug)
	]
);

export const customFieldValues = sqliteTable(
	'custom_field_values',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		fieldId: text('field_id')
			.notNull()
			.references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
		value: text('value'),
		numericValue: real('numeric_value'),
		dateValue: text('date_value'),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		uniqueIndex('custom_field_values_task_field_idx').on(table.taskId, table.fieldId),
		index('custom_field_values_field_id_idx').on(table.fieldId)
	]
);

// ─── 7. Automation / Workflow Engine ────────────────────────────────────────

export const automationRules = sqliteTable(
	'automation_rules',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id),
		name: text('name').notNull(),
		description: text('description'),
		trigger: text('trigger', { mode: 'json' }).$type<{
			event: string;
			conditions: { field: string; operator: string; value: unknown }[];
		}>().notNull(),
		actions: text('actions', { mode: 'json' }).$type<{
			type: string;
			params: Record<string, unknown>;
		}[]>().notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		executionCount: integer('execution_count').notNull().default(0),
		lastExecutedAt: text('last_executed_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('automation_rules_project_id_idx').on(table.projectId),
		index('automation_rules_active_idx').on(table.isActive)
	]
);

export const automationExecutionLog = sqliteTable(
	'automation_execution_log',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		ruleId: text('rule_id')
			.notNull()
			.references(() => automationRules.id, { onDelete: 'cascade' }),
		triggerEvent: text('trigger_event').notNull(),
		triggerData: text('trigger_data', { mode: 'json' }).$type<Record<string, unknown>>(),
		actionsExecuted: text('actions_executed', { mode: 'json' }).$type<{
			type: string;
			success: boolean;
			error?: string;
		}[]>(),
		status: text('status', { enum: ['success', 'partial_failure', 'failure'] }).notNull(),
		durationMs: integer('duration_ms'),
		executedAt: text('executed_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('automation_exec_log_rule_id_idx').on(table.ruleId),
		index('automation_exec_log_status_idx').on(table.status)
	]
);

// ─── 8. AI Intelligence Engine ──────────────────────────────────────────────

export const aiSuggestions = sqliteTable(
	'ai_suggestions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type', {
			enum: [
				'task_breakdown',
				'priority_recommendation',
				'assignee_recommendation',
				'duplicate_detection',
				'effort_estimate',
				'risk_flag',
				'dependency_suggestion',
				'label_suggestion',
				'summary',
				'blockers_analysis'
			]
		}).notNull(),
		title: text('title').notNull(),
		body: text('body').notNull(),
		confidence: real('confidence').notNull(),
		metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
		status: text('status', { enum: ['pending', 'accepted', 'dismissed', 'expired'] })
			.notNull()
			.default('pending'),
		acceptedAt: text('accepted_at'),
		dismissedAt: text('dismissed_at'),
		expiresAt: text('expires_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('ai_suggestions_project_id_idx').on(table.projectId),
		index('ai_suggestions_task_id_idx').on(table.taskId),
		index('ai_suggestions_user_id_idx').on(table.userId),
		index('ai_suggestions_status_idx').on(table.status),
		index('ai_suggestions_type_idx').on(table.type)
	]
);

export const aiConversations = sqliteTable(
	'ai_conversations',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title'),
		context: text('context', { mode: 'json' }).$type<{
			taskIds?: string[];
			scope: 'project' | 'task' | 'global';
		}>(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('ai_conversations_project_id_idx').on(table.projectId),
		index('ai_conversations_user_id_idx').on(table.userId)
	]
);

export const aiConversationMessages = sqliteTable(
	'ai_conversation_messages',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => aiConversations.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
		content: text('content').notNull(),
		toolCalls: text('tool_calls', { mode: 'json' }).$type<{
			name: string;
			arguments: Record<string, unknown>;
			result?: unknown;
		}[]>(),
		tokenCount: integer('token_count'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [index('ai_conv_messages_conversation_id_idx').on(table.conversationId)]
);

// ─── 9. Goals & OKR Tracking ───────────────────────────────────────────────

export const goals = sqliteTable(
	'goals',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		parentGoalId: text('parent_goal_id'),
		title: text('title').notNull(),
		description: text('description'),
		type: text('type', { enum: ['objective', 'key_result', 'initiative'] }).notNull(),
		status: text('status', {
			enum: ['draft', 'active', 'at_risk', 'behind', 'on_track', 'completed', 'cancelled']
		})
			.notNull()
			.default('draft'),
		progressType: text('progress_type', {
			enum: ['manual', 'task_count', 'task_story_points', 'key_result_average']
		})
			.notNull()
			.default('manual'),
		progressCurrent: real('progress_current').notNull().default(0),
		progressTarget: real('progress_target').notNull().default(100),
		unit: text('unit').default('%'),
		startDate: text('start_date'),
		dueDate: text('due_date'),
		completedAt: text('completed_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('goals_project_id_idx').on(table.projectId),
		index('goals_owner_id_idx').on(table.ownerId),
		index('goals_parent_goal_id_idx').on(table.parentGoalId),
		index('goals_status_idx').on(table.status),
		index('goals_type_idx').on(table.type)
	]
);

export const goalTaskLinks = sqliteTable(
	'goal_task_links',
	{
		goalId: text('goal_id')
			.notNull()
			.references(() => goals.id, { onDelete: 'cascade' }),
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.goalId, table.taskId] }),
		index('goal_task_links_task_id_idx').on(table.taskId)
	]
);

export const goalCheckIns = sqliteTable(
	'goal_check_ins',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		goalId: text('goal_id')
			.notNull()
			.references(() => goals.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		previousValue: real('previous_value').notNull(),
		newValue: real('new_value').notNull(),
		note: text('note'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [index('goal_check_ins_goal_id_idx').on(table.goalId)]
);

// ─── 10. Project Templates ─────────────────────────────────────────────────

export const projectTemplates = sqliteTable(
	'project_templates',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		createdBy: text('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		category: text('category', {
			enum: ['engineering', 'marketing', 'design', 'operations', 'sales', 'hr', 'custom']
		})
			.notNull()
			.default('custom'),
		isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
		templateData: text('template_data', { mode: 'json' }).$type<{
			columns: { name: string; position: number; color: string; wipLimit?: number }[];
			taskTemplates: {
				title: string;
				description?: string;
				priority: string;
				columnIndex: number;
				labels?: string[];
				storyPoints?: number;
				estimateMinutes?: number;
			}[];
			labels: { name: string; color: string }[];
			customFields?: {
				name: string;
				slug: string;
				fieldType: string;
				options?: { label: string; value: string; color?: string }[];
			}[];
			automationRules?: {
				name: string;
				trigger: { event: string; conditions: { field: string; operator: string; value: unknown }[] };
				actions: { type: string; params: Record<string, unknown> }[];
			}[];
		}>().notNull(),
		usageCount: integer('usage_count').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(current_timestamp)`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(current_timestamp)`)
	},
	(table) => [
		index('project_templates_created_by_idx').on(table.createdBy),
		index('project_templates_category_idx').on(table.category),
		index('project_templates_public_idx').on(table.isPublic)
	]
);

// ─── Type Exports ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type Column = typeof columns.$inferSelect;
export type NewColumn = typeof columns.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Label = typeof labels.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserTotpCredential = typeof userTotpCredentials.$inferSelect;
export type UserRecoveryCode = typeof userRecoveryCodes.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type RecurringTaskRule = typeof recurringTaskRules.$inferSelect;
export type NewRecurringTaskRule = typeof recurringTaskRules.$inferInsert;
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;
export type AutomationExecution = typeof automationExecutionLog.$inferSelect;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiConversationMessage = typeof aiConversationMessages.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type GoalTaskLink = typeof goalTaskLinks.$inferSelect;
export type GoalCheckIn = typeof goalCheckIns.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type NewProjectTemplate = typeof projectTemplates.$inferInsert;
