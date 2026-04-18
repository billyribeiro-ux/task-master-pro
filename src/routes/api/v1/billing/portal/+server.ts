import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { stripe } from '$lib/server/payments/stripe.js';
import { ORIGIN } from '$env/static/private';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	if (!locals.user.stripeCustomerId) {
		throw error(400, 'No billing account found. Please subscribe first.');
	}

	const session = await stripe.billingPortal.sessions.create({
		customer: locals.user.stripeCustomerId,
		return_url: `${ORIGIN}/settings/billing`
	});

	throw redirect(303, session.url);
};
