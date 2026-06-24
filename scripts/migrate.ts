import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

const projectRoot = process.cwd();
const localEnvPath = resolve(projectRoot, '.env.local');
const shisakuEnvPath = resolve(projectRoot, '../Shisaku/.env');

if (existsSync(shisakuEnvPath)) {
	config({ path: shisakuEnvPath, quiet: true });
}

if (existsSync(localEnvPath)) {
	config({ path: localEnvPath, quiet: true, override: false });
}

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
