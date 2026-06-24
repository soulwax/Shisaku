import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '../Shisaku/.env') });

const migrationUrl = process.env.DATABASE_URL_UNPOOLED;

if (!migrationUrl) {
	throw new Error('DATABASE_URL_UNPOOLED is required.');
}

const client = postgres(migrationUrl, {
	max: 1,
	connect_timeout: 15,
	idle_timeout: 5,
});

try {
	await migrate(drizzle(client), {
		migrationsFolder: resolve(process.cwd(), 'drizzle'),
	});
	console.log('Database migrations are up to date.');
} finally {
	await client.end();
}
