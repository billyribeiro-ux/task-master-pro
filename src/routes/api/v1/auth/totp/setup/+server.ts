import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { users, userTotpCredentials } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/guards.js';
import { verifyPassword } from '$lib/server/auth/index.js';
import { totpSetupSchema } from '$lib/validation/totp.js';
import { generateTotpSecret, generateTotpUri } from '$lib/server/auth/totp.js';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	const body = await event.request.json();
	const result = totpSetupSchema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	// Verify the user's password
	const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

	if (!dbUser || !dbUser.passwordHash) {
		throw error(400, 'Password authentication is not set up for this account');
	}

	const passwordValid = await verifyPassword(dbUser.passwordHash, result.data.password);
	if (!passwordValid) {
		throw error(401, 'Invalid password');
	}

	// Check if TOTP is already set up and verified
	const [existingTotp] = await db
		.select()
		.from(userTotpCredentials)
		.where(eq(userTotpCredentials.userId, user.id))
		.limit(1);

	if (existingTotp?.verified) {
		throw error(400, 'Two-factor authentication is already enabled');
	}

	const secret = generateTotpSecret();
	const uri = generateTotpUri(secret, user.email);

	// Upsert the TOTP credential (replace any unverified setup)
	if (existingTotp) {
		await db
			.update(userTotpCredentials)
			.set({ secret, verified: false })
			.where(eq(userTotpCredentials.userId, user.id));
	} else {
		await db.insert(userTotpCredentials).values({
			userId: user.id,
			secret,
			verified: false
		});
	}

	return json({
		secret,
		uri,
		message: 'Scan the QR code with your authenticator app, then verify with a code'
	});
};
