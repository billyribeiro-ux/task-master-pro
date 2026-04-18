import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users, userTotpCredentials, userRecoveryCodes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { verifyPassword } from '$lib/server/auth/index.js';
import { totpDisableSchema } from '$lib/validation/totp.js';
import { verifyTotpCode } from '$lib/server/auth/totp.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = totpDisableSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { password, code } = result.data;

	// Verify the user's password
	const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

	if (!dbUser || !dbUser.passwordHash) {
		throw error(400, 'Password authentication is not set up for this account');
	}

	const passwordValid = await verifyPassword(dbUser.passwordHash, password);
	if (!passwordValid) {
		throw error(401, 'Invalid password');
	}

	// Check if TOTP is enabled
	const [totp] = await db
		.select()
		.from(userTotpCredentials)
		.where(eq(userTotpCredentials.userId, user.id))
		.limit(1);

	if (!totp || !totp.verified) {
		throw error(400, 'Two-factor authentication is not enabled');
	}

	// Verify the TOTP code
	const valid = verifyTotpCode(totp.secret, code);
	if (!valid) {
		throw error(400, 'Invalid TOTP code');
	}

	// Delete TOTP credential and recovery codes
	await db.delete(userTotpCredentials).where(eq(userTotpCredentials.userId, user.id));

	await db.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id));

	return json({
		message: 'Two-factor authentication has been disabled'
	});
};
