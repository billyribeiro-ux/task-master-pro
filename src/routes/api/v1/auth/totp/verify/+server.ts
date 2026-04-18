import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { userTotpCredentials, userRecoveryCodes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { totpVerifySchema } from '$lib/validation/totp.js';
import { verifyTotpCode, generateRecoveryCodes, hashRecoveryCode } from '$lib/server/auth/totp.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = totpVerifySchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { code } = result.data;

	// Retrieve the pending TOTP credential
	const [totp] = await db
		.select()
		.from(userTotpCredentials)
		.where(eq(userTotpCredentials.userId, user.id))
		.limit(1);

	if (!totp) {
		throw error(400, 'No TOTP setup in progress. Please initiate setup first.');
	}

	if (totp.verified) {
		throw error(400, 'Two-factor authentication is already verified and active');
	}

	// Verify the code against the secret
	const valid = verifyTotpCode(totp.secret, code);
	if (!valid) {
		throw error(400, 'Invalid TOTP code. Please try again.');
	}

	// Mark TOTP as verified
	await db
		.update(userTotpCredentials)
		.set({ verified: true })
		.where(eq(userTotpCredentials.id, totp.id));

	// Generate recovery codes
	const recoveryCodes = generateRecoveryCodes(8);

	// Delete any old recovery codes and insert new ones
	await db.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id));

	const recoveryCodeValues = recoveryCodes.map((code) => ({
		userId: user.id,
		codeHash: hashRecoveryCode(code)
	}));

	await db.insert(userRecoveryCodes).values(recoveryCodeValues);

	return json({
		message: 'Two-factor authentication has been enabled successfully',
		recoveryCodes
	});
};
