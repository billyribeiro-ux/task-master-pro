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
