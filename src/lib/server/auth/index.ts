import { createHash } from 'node:crypto';
import { db } from '$lib/server/db/index.js';
import { sessions, users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	role: 'user' | 'admin' | 'superadmin';
	plan: 'free' | 'pro' | 'enterprise';
	stripeCustomerId: string | null;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export type SessionValidationResult =
	| { session: Session; user: SessionUser }
	| { session: null; user: null };

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(token: string, userId: string): Promise<Session> {
	const sessionId = hashToken(token);
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		expiresAt
	});

	return { id: sessionId, userId, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
	const sessionId = hashToken(token);

	const result = await db
		.select({
			session: sessions,
			user: {
				id: users.id,
				email: users.email,
				name: users.name,
				avatarUrl: users.avatarUrl,
				role: users.role,
				plan: users.plan,
				stripeCustomerId: users.stripeCustomerId
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (result.length === 0) {
		return { session: null, user: null };
	}

	const { session: sessionRow, user } = result[0];
	const session: Session = {
		id: sessionRow.id,
		userId: sessionRow.userId,
		expiresAt: sessionRow.expiresAt
	};

	if (Date.now() >= session.expiresAt.getTime()) {
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return { session: null, user: null };
	}

	// Sliding window: extend session if within 15 days of expiry
	const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
	if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD_MS) {
		session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		await db
			.update(sessions)
			.set({ expiresAt: session.expiresAt })
			.where(eq(sessions.id, session.id));
	}

	return { session, user: user as SessionUser };
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function hashPassword(password: string): Promise<string> {
	return await hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	return await verify(hash, password);
}

export const SESSION_COOKIE_NAME = 'session';

export function createSessionCookie(token: string): {
	name: string;
	value: string;
	attributes: Record<string, unknown>;
} {
	return {
		name: SESSION_COOKIE_NAME,
		value: token,
		attributes: {
			httpOnly: true,
			sameSite: 'lax' as const,
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: SESSION_DURATION_MS / 1000
		}
	};
}

export function createBlankSessionCookie(): {
	name: string;
	value: string;
	attributes: Record<string, unknown>;
} {
	return {
		name: SESSION_COOKIE_NAME,
		value: '',
		attributes: {
			httpOnly: true,
			sameSite: 'lax' as const,
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 0
		}
	};
}
