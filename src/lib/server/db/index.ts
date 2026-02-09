import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { env } from '$env/dynamic/private';
import * as schema from './schema.js';

const client = createClient({
	url: env.DATABASE_URL ?? 'file:./local.db'
});

// Enable WAL mode for better concurrent read performance
client.execute('PRAGMA journal_mode = WAL').catch(() => {
	// WAL mode may already be set or not supported in some libsql configs
});
client.execute('PRAGMA foreign_keys = ON').catch(() => {});

export const db = drizzle(client, { schema });
export { client };
