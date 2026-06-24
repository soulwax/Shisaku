// @ts-check

import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { config } from 'dotenv';
import { defineConfig, sessionDrivers } from 'astro/config';
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

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.shisaku.dev',
	output: 'server',
	adapter: vercel({
		maxDuration: 30,
		webAnalytics: {
			enabled: true,
		},
	}),
	integrations: [sitemap()],
	session: {
		driver: sessionDrivers.redis({
			url: process.env.REDIS_URL,
		}),
	},
});
