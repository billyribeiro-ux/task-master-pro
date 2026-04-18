import { createHmac } from 'crypto';
import { db } from '$lib/server/db/index.js';
import { webhookEndpoints, webhookDeliveries } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Create an HMAC-SHA256 signature for a webhook payload.
 */
export function signPayload(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Record a webhook delivery attempt in the database.
 */
export async function recordDelivery(
	endpointId: string,
	event: string,
	payload: Record<string, unknown>,
	response: { status: number | null; body: string | null; success: boolean },
	attemptCount: number
) {
	const now = new Date().toISOString();
	const status = response.success ? 'delivered' : 'failed';

	let nextRetryAt: string | null = null;
	if (!response.success && attemptCount < MAX_RETRY_ATTEMPTS) {
		const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attemptCount - 1);
		nextRetryAt = new Date(Date.now() + delayMs).toISOString();
	}

	const [delivery] = await db
		.insert(webhookDeliveries)
		.values({
			endpointId,
			event,
			payload,
			responseStatus: response.status,
			responseBody: response.body,
			attemptCount,
			status: status as 'pending' | 'delivered' | 'failed',
			nextRetryAt,
			deliveredAt: response.success ? now : null
		})
		.returning();

	return delivery;
}

/**
 * Send a webhook request to a single endpoint with retry logic.
 */
async function sendWebhook(
	endpoint: typeof webhookEndpoints.$inferSelect,
	event: string,
	payload: Record<string, unknown>
): Promise<void> {
	const body = JSON.stringify(payload);
	const signature = signPayload(body, endpoint.secret);
	const timestamp = new Date().toISOString();

	for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
		try {
			const response = await fetch(endpoint.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Webhook-Signature': `sha256=${signature}`,
					'X-Webhook-Event': event,
					'X-Webhook-Timestamp': timestamp,
					'X-Webhook-Id': endpoint.id,
					'User-Agent': 'TaskMasterPro-Webhooks/1.0'
				},
				body,
				signal: AbortSignal.timeout(10000)
			});

			const responseBody = await response.text().catch(() => null);
			const success = response.status >= 200 && response.status < 300;

			await recordDelivery(
				endpoint.id,
				event,
				payload,
				{
					status: response.status,
					body: responseBody,
					success
				},
				attempt
			);

			if (success) {
				// Reset failure count on success
				await db
					.update(webhookEndpoints)
					.set({ failureCount: 0, lastTriggeredAt: timestamp })
					.where(eq(webhookEndpoints.id, endpoint.id));
				return;
			}

			// If not the last attempt, apply exponential backoff
			if (attempt < MAX_RETRY_ATTEMPTS) {
				const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';

			await recordDelivery(
				endpoint.id,
				event,
				payload,
				{
					status: null,
					body: errorMessage,
					success: false
				},
				attempt
			);

			if (attempt < MAX_RETRY_ATTEMPTS) {
				const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	// All retries exhausted - increment failure count
	await db
		.update(webhookEndpoints)
		.set({
			failureCount: (endpoint.failureCount ?? 0) + 1,
			lastTriggeredAt: new Date().toISOString()
		})
		.where(eq(webhookEndpoints.id, endpoint.id));
}

/**
 * Dispatch a webhook event to all matching active endpoints for a project.
 * Finds endpoints subscribed to the given event, signs the payload, and sends with retries.
 */
export async function dispatchWebhook(
	projectId: string,
	event: string,
	payload: Record<string, unknown>
): Promise<void> {
	const endpoints = await db
		.select()
		.from(webhookEndpoints)
		.where(and(eq(webhookEndpoints.projectId, projectId), eq(webhookEndpoints.isActive, true)));

	// Filter to endpoints that are subscribed to this event
	const matchingEndpoints = endpoints.filter((ep) => {
		const events = ep.events as string[];
		return events.includes(event);
	});

	// Dispatch to all matching endpoints in parallel (fire-and-forget)
	const dispatches = matchingEndpoints.map((endpoint) =>
		sendWebhook(endpoint, event, {
			event,
			timestamp: new Date().toISOString(),
			projectId,
			data: payload
		})
	);

	await Promise.allSettled(dispatches);
}
