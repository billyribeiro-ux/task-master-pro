import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { stripe } from '$lib/server/payments/stripe.js';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		throw error(400, 'Missing stripe-signature header');
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('Stripe webhook signature verification failed:', err);
		throw error(400, 'Invalid signature');
	}

	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			const userId = session.metadata?.userId;
			const customerId = session.customer as string;

			if (userId) {
				await db
					.update(users)
					.set({
						plan: 'pro',
						stripeCustomerId: customerId,
						updatedAt: new Date().toISOString()
					})
					.where(eq(users.id, userId));
			}
			break;
		}

		case 'customer.subscription.updated': {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;

			const plan = subscription.status === 'active' ? 'pro' : 'free';

			await db
				.update(users)
				.set({ plan, updatedAt: new Date().toISOString() })
				.where(eq(users.stripeCustomerId, customerId));
			break;
		}

		case 'customer.subscription.deleted': {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;

			await db
				.update(users)
				.set({ plan: 'free', updatedAt: new Date().toISOString() })
				.where(eq(users.stripeCustomerId, customerId));
			break;
		}

		case 'invoice.payment_failed': {
			const invoice = event.data.object as Stripe.Invoice;
			const customerId = invoice.customer as string;

			console.warn(`Payment failed for customer ${customerId}`);
			break;
		}

		default:
			break;
	}

	return json({ received: true });
};
