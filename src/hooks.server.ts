import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { nanoid } from 'nanoid';
import {
	validateSessionToken,
	SESSION_COOKIE_NAME,
	createSessionCookie,
	createBlankSessionCookie
} from '$lib/server/auth/index.js';
import { logger } from '$lib/server/logger.js';
import { checkRateLimit } from '$lib/server/rate-limit.js';
import { validateEnv } from '$lib/server/env.js';
import { closeRedis } from '$lib/server/redis.js';

// Fail fast on misconfiguration at server startup.
validateEnv();

const requestIdHandle: Handle = async ({ event, resolve }) => {
	const requestId = nanoid(21);
	event.locals.requestId = requestId;

	const start = Date.now();
	const response = await resolve(event);
	response.headers.set('X-Request-Id', requestId);

	logger.info(
		{
			requestId: event.locals.requestId,
			method: event.request.method,
			url: event.url.pathname,
			status: response.status,
			duration: Date.now() - start
		},
		'request completed'
	);

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

	// Content-Security-Policy is emitted by SvelteKit (kit.csp in svelte.config.js)
	// with per-response nonces, so it is intentionally not set here.
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_AUTH_MAX = 10;

const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const isAuthRoute =
		path.startsWith('/auth') || path.startsWith('/login') || path.startsWith('/register');
	const isApiRoute = path.startsWith('/api');

	if (!isAuthRoute && !isApiRoute) {
		return resolve(event);
	}

	// getClientAddress() honours adapter-node's ADDRESS_HEADER + XFF_DEPTH config,
	// so the client IP is only trusted from the configured proxy hop (not a raw,
	// spoofable x-forwarded-for value).
	const clientIp = event.getClientAddress();
	const limit = isAuthRoute ? RATE_LIMIT_AUTH_MAX : RATE_LIMIT_MAX_REQUESTS;
	const key = `${clientIp}:${isAuthRoute ? 'auth' : 'api'}`;

	const result = await checkRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);

	if (!result.allowed) {
		logger.warn({ ip: clientIp, path: event.url.pathname }, 'rate limit exceeded');
		return new Response(JSON.stringify({ error: 'Too many requests' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)))
			}
		});
	}

	const response = await resolve(event);
	response.headers.set('X-RateLimit-Limit', String(limit));
	response.headers.set('X-RateLimit-Remaining', String(result.remaining));
	response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
	return response;
};

export const handle = sequence(
	requestIdHandle,
	apiKeyAuthHandle,
	authHandle,
	securityHeadersHandle,
	rateLimitHandle
);

// Centralised server error reporting. Logs the full error with the request's
// correlation id and returns a safe, user-facing shape that surfaces the
// requestId so users can quote it to support without leaking internals.
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId ?? 'unknown';
	logger.error(
		{ err: error, requestId, status, path: event.url.pathname },
		'unhandled server error'
	);
	return {
		message: status >= 500 ? 'An unexpected error occurred. Please try again.' : message,
		requestId
	};
};

// Graceful shutdown: close external connections so rolling deploys don't drop
// in-flight work or leak sockets.
let shuttingDown = false;
async function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info({ signal }, 'shutting down — closing connections');
	await closeRedis();
	process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.once(signal, () => {
		void shutdown(signal);
	});
}
