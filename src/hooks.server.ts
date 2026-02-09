import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { nanoid } from 'nanoid';
import {
	validateSessionToken,
	SESSION_COOKIE_NAME,
	createSessionCookie,
	createBlankSessionCookie
} from '$lib/server/auth/index.js';
import { logger } from '$lib/server/logger.js';

const requestIdHandle: Handle = async ({ event, resolve }) => {
	const requestId = nanoid(21);
	event.locals.requestId = requestId;

	const start = Date.now();
	const response = await resolve(event);
	response.headers.set('X-Request-Id', requestId);

	logger.info({
		requestId: event.locals.requestId,
		method: event.request.method,
		url: event.url.pathname,
		status: response.status,
		duration: Date.now() - start
	}, 'request completed');

	return response;
};

const apiKeyAuthHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (!path.startsWith('/api/v1')) {
		return resolve(event);
	}

	const authHeader = event.request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer tmk_')) {
		return resolve(event);
	}

	try {
		const { validateApiKey } = await import('$lib/server/auth/api-keys.js');
		const user = await validateApiKey(authHeader.slice(7));
		if (user) {
			event.locals.user = user;
			event.locals.session = null;
		}
	} catch {
		// Fall through to session auth
	}

	return resolve(event);
};

const authHandle: Handle = async ({ event, resolve }) => {
	if (event.locals.user) {
		return resolve(event);
	}

	const token = event.cookies.get(SESSION_COOKIE_NAME);

	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await validateSessionToken(token);

	if (session) {
		const cookie = createSessionCookie(token);
		event.cookies.set(cookie.name, cookie.value, {
			path: cookie.attributes.path as string,
			httpOnly: cookie.attributes.httpOnly as boolean,
			sameSite: cookie.attributes.sameSite as 'lax',
			secure: cookie.attributes.secure as boolean,
			maxAge: cookie.attributes.maxAge as number
		});
	} else {
		const cookie = createBlankSessionCookie();
		event.cookies.set(cookie.name, cookie.value, {
			path: cookie.attributes.path as string,
			httpOnly: cookie.attributes.httpOnly as boolean,
			sameSite: cookie.attributes.sameSite as 'lax',
			secure: cookie.attributes.secure as boolean,
			maxAge: cookie.attributes.maxAge as number
		});
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set(
		'content-security-policy',
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
	);
	response.headers.set(
		'strict-transport-security',
		'max-age=31536000; includeSubDomains'
	);
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_AUTH_MAX = 10;

// Periodic cleanup of expired rate limit entries (every 60 seconds)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanupRateLimitMap() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;
	for (const [key, value] of rateLimitMap) {
		if (now > value.resetAt) {
			rateLimitMap.delete(key);
		}
	}
}

const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const isAuthRoute = path.startsWith('/auth') || path.startsWith('/login') || path.startsWith('/register');
	const isApiRoute = path.startsWith('/api');

	if (!isAuthRoute && !isApiRoute) {
		return resolve(event);
	}

	cleanupRateLimitMap();

	const clientIp = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
		?? event.getClientAddress();
	const key = `${clientIp}:${isAuthRoute ? 'auth' : 'api'}`;
	const now = Date.now();
	const limit = isAuthRoute ? RATE_LIMIT_AUTH_MAX : RATE_LIMIT_MAX_REQUESTS;

	const entry = rateLimitMap.get(key);

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return resolve(event);
	}

	if (entry.count >= limit) {
		logger.warn({ ip: clientIp, path: event.url.pathname }, 'rate limit exceeded');
		return new Response(JSON.stringify({ error: 'Too many requests' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000))
			}
		});
	}

	entry.count++;
	return resolve(event);
};

export const handle = sequence(requestIdHandle, apiKeyAuthHandle, authHandle, securityHeadersHandle, rateLimitHandle);
