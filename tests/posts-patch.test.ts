import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLocalEnv } from '../scripts/load-local-env.mjs';

loadLocalEnv();

test(
	'patchPost, tag operations, and listPosts work against the configured database',
	{ skip: !process.env.DATABASE_URL },
	async () => {
		const { closeDatabase } = await import('../src/db/client');
		const { createPost, deletePost, listPosts, getPostByIdOrSlug, patchPost } = await import(
			'../src/lib/posts'
		);
		const suffix = Date.now();
		const slug = `patch-test-${suffix}`;
		const tag = `patch-tag-${suffix}`;
		let createdId: string | undefined;

		try {
			const created = await createPost({
				title: `Patch test ${suffix}`,
				slug,
				description: 'Temporary post created by the test suite.',
				bodyMarkdown: '# Draft',
				status: 'draft',
				pubDate: new Date(),
				tags: [tag],
			});
			createdId = created.id;

			// createPost honors the requested slug.
			assert.equal(created.slug, slug);

			// Lookup works by id and by slug.
			assert.equal((await getPostByIdOrSlug(created.id))?.id, created.id);
			assert.equal((await getPostByIdOrSlug(slug))?.id, created.id);

			// A single-field patch leaves everything else untouched.
			const published = await patchPost(created.id, { status: 'published' });
			assert.equal(published.status, 'published');
			assert.equal(published.title, `Patch test ${suffix}`);
			assert.equal(published.bodyMarkdown, '# Draft');
			assert.deepEqual(published.tags, [tag]);

			// Incremental tag changes.
			const tagged = await patchPost(created.id, { addTags: ['extra'] });
			assert.deepEqual(tagged.tags, [tag, 'extra']);

			const untagged = await patchPost(created.id, { removeTags: ['EXTRA'] });
			assert.deepEqual(untagged.tags, [tag]);

			// listPosts filters by status and tag.
			const byTag = await listPosts({ status: 'published', tag });
			assert.equal(byTag.some((post) => post.id === created.id), true);

			const drafts = await listPosts({ status: 'draft', tag });
			assert.equal(drafts.some((post) => post.id === created.id), false);

			await deletePost(created.id);
			createdId = undefined;
		} finally {
			if (createdId) {
				await deletePost(createdId);
			}
			await closeDatabase();
		}
	},
);
