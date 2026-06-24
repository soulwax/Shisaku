import { config } from 'dotenv';
import matter from 'gray-matter';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const projectRoot = process.cwd();
const localEnvPath = resolve(projectRoot, '.env.local');
const shisakuEnvPath = resolve(projectRoot, '../Shisaku/.env');

if (existsSync(shisakuEnvPath)) {
	config({ path: shisakuEnvPath, quiet: true });
}

if (existsSync(localEnvPath)) {
	config({ path: localEnvPath, quiet: true, override: false });
}

const { closeDatabase } = await import('../src/db/client');
const { upsertSeedPost } = await import('../src/lib/posts');
const contentDirectory = resolve(projectRoot, 'scripts/seed-content');
const files = (await readdir(contentDirectory)).filter((file) => /\.(md|mdx)$/.test(file));

try {
	for (const file of files) {
		const source = await readFile(resolve(contentDirectory, file), 'utf8');
		const parsed = matter(source);
		const slug = basename(file, extname(file));

		await upsertSeedPost({
			slug,
			title: String(parsed.data.title),
			description: String(parsed.data.description),
			bodyMarkdown: parsed.content.trim(),
			status: parsed.data.status === 'draft' ? 'draft' : 'published',
			pubDate: new Date(parsed.data.pubDate),
			heroImage: parsed.data.heroImage ? String(parsed.data.heroImage) : null,
			tags: Array.isArray(parsed.data.tags)
				? parsed.data.tags.map(String)
				: ['devlog', 'build-notes'],
		});

		console.log(`Seeded ${slug}`);
	}

	console.log(`Seeded ${files.length} posts.`);
} finally {
	await closeDatabase();
}
