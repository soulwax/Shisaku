// @ts-check

import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { defineConfig, sessionDrivers } from 'astro/config';
import { loadLocalEnv } from './scripts/load-local-env.mjs';

loadLocalEnv();

// https://astro.build/config
export default defineConfig({
	site: 'https://shisaku.dev',
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
