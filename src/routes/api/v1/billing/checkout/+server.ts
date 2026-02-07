import { json, error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { stripe } from '$lib/server/payments/stripe.js';
import { ORIGIN } from '$env/static/private';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		payment_method_types: ['card'],
		line_items: [
			{
				price_data: {
					currency: 'usd',
					product_data: {
						name: 'TaskMaster Pro',
						description: 'Unlimited projects, advanced analytics, priority support'
					},
					unit_amount: 1200,
					recurring: { interval: 'month' }
				},
				quantity: 1
			}
		],
		metadata: {
			userId: locals.user.id
		},
		customer_email: locals.user.stripeCustomerId ? undefined : locals.user.email,
		customer: locals.user.stripeCustomerId ?? undefined,
		success_url: `${ORIGIN}/settings/billing?success=true`,
		cancel_url: `${ORIGIN}/settings/billing?cancelled=true`
	});

	if (session.url) {
		throw redirect(303, session.url);
	}

	return json({ error: 'Failed to create checkout session' }, { status: 500 });
};
