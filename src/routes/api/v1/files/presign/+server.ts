import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { fileAttachments, tasks } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectAccess } from '$lib/server/auth/guards.js';
import { checkFeatureLimit } from '$lib/server/payments/guards.js';
import { getPresignedUploadUrl } from '$lib/server/storage/s3.js';
import { createId } from '@paralleldrive/cuid2';

const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
	'application/pdf',
	'text/plain', 'text/csv', 'text/markdown',
	'application/json',
	'application/zip', 'application/gzip',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const presignSchema = z.object({
	taskId: z.string().min(1),
	fileName: z.string().min(1).max(255),
	mimeType: z.string().min(1),
	fileSize: z.number().int().min(1).max(100 * 1024 * 1024)
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthorized');

	const body = await event.request.json();
	const result = presignSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { taskId, fileName, mimeType, fileSize } = result.data;

	if (!ALLOWED_MIME_TYPES.has(mimeType)) {
		throw error(400, `File type '${mimeType}' is not allowed`);
	}

	const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
	if (!task) throw error(404, 'Task not found');

	await requireProjectAccess(event, task.projectId);

	// Check plan limits before generating presigned URL
	const planCheck = await checkFeatureLimit(event.locals.user.id, 'fileUpload');
	if (!planCheck.allowed) {
		throw error(403, `Plan limit reached: file upload limit exceeded on your current plan`);
	}

	const ext = fileName.split('.').pop() ?? '';
	const s3Key = `${task.projectId}/${taskId}/${createId()}.${ext}`;

	const uploadUrl = await getPresignedUploadUrl(s3Key, mimeType, fileSize);

	const [attachment] = await db
		.insert(fileAttachments)
		.values({
			taskId,
			uploaderId: event.locals.user.id,
			fileName,
			fileSize,
			mimeType,
			s3Key
		})
		.returning();

	return json({ uploadUrl, attachment }, { status: 201 });
};
