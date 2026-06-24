import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../Shisaku/.env') });

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
