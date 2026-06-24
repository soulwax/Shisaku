import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
	throw new Error('DATABASE_URL_UNPOOLED is required to run Drizzle migrations.');
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: migrationUrl,
	},
});
