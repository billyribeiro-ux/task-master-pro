import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	try {
		await db.run(sql`SELECT 1`);

		return json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			version: '0.1.0'
		});
	} catch (err) {
		return json(
			{
				status: 'error',
				timestamp: new Date().toISOString(),
				message: 'Database connection failed'
			},
			{ status: 503 }
		);
	}
};
