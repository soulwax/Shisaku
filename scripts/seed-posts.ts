import { config } from 'dotenv';
import matter from 'gray-matter';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../Shisaku/.env') });

const { closeDatabase } = await import('../src/db/client');
const { upsertSeedPost } = await import('../src/lib/posts');
const contentDirectory = resolve(process.cwd(), 'scripts/seed-content');
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
			status: 'published',
			pubDate: new Date(parsed.data.pubDate),
			tags: ['devlog', 'build-notes'],
		});

		console.log(`Seeded ${slug}`);
	}

	console.log(`Seeded ${files.length} posts.`);
} finally {
	await closeDatabase();
}
