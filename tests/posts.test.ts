import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLocalEnv } from '../scripts/load-local-env.mjs';

loadLocalEnv();

test(
	'post CRUD works against the configured database',
	{ skip: !process.env.DATABASE_URL },
	async () => {
		const { closeDatabase } = await import('../src/db/client');
		const {
			createPost,
			deletePost,
			getPostById,
			getPublishedPostBySlug,
			updatePost,
		} = await import('../src/lib/posts');
		const suffix = Date.now();
		const slug = `integration-test-${suffix}`;
		let createdId: string | undefined;
		let duplicateId: string | undefined;

		try {
			const created = await createPost({
				title: `Integration test ${suffix}`,
				description: 'Temporary post created by the test suite.',
				bodyMarkdown: '# Draft',
				status: 'draft',
				pubDate: new Date(),
				tags: ['test'],
			});
			createdId = created.id;

			assert.equal(created.status, 'draft');
			assert.equal(created.slug, slug);
			assert.equal((await getPostById(created.id))?.slug, slug);
			assert.equal(await getPublishedPostBySlug(slug), null);

			const duplicate = await createPost({
				title: `Integration test ${suffix}`,
				description: 'Temporary post created by the test suite.',
				bodyMarkdown: '# Draft',
				status: 'draft',
				pubDate: new Date(),
				tags: ['test'],
			});
			duplicateId = duplicate.id;
			assert.equal(duplicate.slug, `${slug}-2`);

			const updated = await updatePost(created.id, {
				title: 'Integration test',
				description: 'Temporary post created by the test suite.',
				bodyMarkdown: '# Published',
				status: 'published',
				pubDate: new Date(),
				tags: ['test'],
			});

			assert.equal(updated.status, 'published');
			assert.equal(updated.slug, slug);
			assert.equal((await getPublishedPostBySlug(slug))?.id, created.id);

			await deletePost(duplicate.id);
			duplicateId = undefined;
			await deletePost(created.id);
			createdId = undefined;
			assert.equal(await getPostById(created.id), null);
		} finally {
			if (duplicateId) {
				await deletePost(duplicateId);
			}
			if (createdId) {
				await deletePost(createdId);
			}
			await closeDatabase();
		}
	},
);
