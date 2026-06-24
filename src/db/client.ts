import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireEnv } from '../lib/env';
import * as schema from './schema';

const client = postgres(requireEnv('DATABASE_URL'), {
	max: 5,
	prepare: false,
	idle_timeout: 20,
	connect_timeout: 15,
});

export const db = drizzle(client, { schema });
export const closeDatabase = () => client.end();
