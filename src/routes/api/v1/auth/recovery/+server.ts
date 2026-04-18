import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { userRecoveryCodes } from '$lib/server/db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { recoveryCodeSchema } from '$lib/validation/totp.js';
import { hashRecoveryCode } from '$lib/server/auth/totp.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = recoveryCodeSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { code } = result.data;
	const codeHash = hashRecoveryCode(code);

	// Find an unused recovery code matching this hash
	const [recoveryCode] = await db
		.select()
		.from(userRecoveryCodes)
		.where(
			and(
				eq(userRecoveryCodes.userId, user.id),
				eq(userRecoveryCodes.codeHash, codeHash),
				isNull(userRecoveryCodes.usedAt)
			)
		)
		.limit(1);

	if (!recoveryCode) {
		throw error(400, 'Invalid or already used recovery code');
	}

	// Mark the recovery code as used
	await db
		.update(userRecoveryCodes)
		.set({ usedAt: new Date().toISOString() })
		.where(eq(userRecoveryCodes.id, recoveryCode.id));

	// Count remaining unused recovery codes
	const remainingCodes = await db
		.select()
		.from(userRecoveryCodes)
		.where(and(eq(userRecoveryCodes.userId, user.id), isNull(userRecoveryCodes.usedAt)));

	return json({
		message: 'Recovery code accepted',
		remainingCodes: remainingCodes.length
	});
};
