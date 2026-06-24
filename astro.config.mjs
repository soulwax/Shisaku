// @ts-check

import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { config } from 'dotenv';
import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';

const envDir = resolve(process.cwd(), '../Shisaku');
config({ path: resolve(envDir, '.env') });

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.shisaku.dev',
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	integrations: [sitemap()],
	vite: {
		envDir,
	},
});
