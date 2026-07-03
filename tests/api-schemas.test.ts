import assert from 'node:assert/strict';
import test from 'node:test';
import {
	apiPostCreateSchema,
	apiPostPatchSchema,
	apiPostReplaceSchema,
	apiTagAddSchema,
	serializePost,
} from '../src/lib/api';
import type { Post } from '../src/db/schema';

const minimalCreate = {
	title: 'Hello',
	description: 'A post.',
	bodyMarkdown: '# Hi',
};

test('create schema accepts a minimal payload and defaults status to draft', () => {
	const parsed = apiPostCreateSchema.safeParse(minimalCreate);
	assert.equal(parsed.success, true);
	assert.equal(parsed.data?.status, 'draft');
	assert.equal(parsed.data?.pubDate, undefined);
});

test('create schema coerces ISO strings into dates', () => {
	const parsed = apiPostCreateSchema.safeParse({
		...minimalCreate,
		pubDate: '2026-07-01T12:00:00Z',
	});
	assert.equal(parsed.success, true);
	assert.equal(parsed.data?.pubDate?.toISOString(), '2026-07-01T12:00:00.000Z');
});

test('create schema rejects missing required fields and bad dates', () => {
	assert.equal(apiPostCreateSchema.safeParse({ title: 'Only a title' }).success, false);
	assert.equal(
		apiPostCreateSchema.safeParse({ ...minimalCreate, pubDate: 'not-a-date' }).success,
		false,
	);
	assert.equal(
		apiPostCreateSchema.safeParse({ ...minimalCreate, status: 'archived' }).success,
		false,
	);
});

test('replace schema requires an explicit status', () => {
	assert.equal(apiPostReplaceSchema.safeParse(minimalCreate).success, false);
	const parsed = apiPostReplaceSchema.safeParse({ ...minimalCreate, status: 'published' });
	assert.equal(parsed.success, true);
	assert.deepEqual(parsed.data?.tags, []);
});

test('patch schema rejects an empty patch', () => {
	assert.equal(apiPostPatchSchema.safeParse({}).success, false);
});

test('patch schema accepts single-field updates', () => {
	assert.equal(apiPostPatchSchema.safeParse({ status: 'published' }).success, true);
	assert.equal(apiPostPatchSchema.safeParse({ addTags: ['rust'] }).success, true);
	assert.equal(apiPostPatchSchema.safeParse({ heroImage: null }).success, true);
});

test('patch schema rejects tags combined with addTags/removeTags', () => {
	assert.equal(apiPostPatchSchema.safeParse({ tags: ['a'], addTags: ['b'] }).success, false);
	assert.equal(apiPostPatchSchema.safeParse({ tags: ['a'], removeTags: ['b'] }).success, false);
	assert.equal(apiPostPatchSchema.safeParse({ addTags: ['a'], removeTags: ['b'] }).success, true);
});

test('tag add schema accepts tag or tags but not neither', () => {
	assert.equal(apiTagAddSchema.safeParse({ tag: 'rust' }).success, true);
	assert.equal(apiTagAddSchema.safeParse({ tags: ['rust', 'gamedev'] }).success, true);
	assert.equal(apiTagAddSchema.safeParse({}).success, false);
	assert.equal(apiTagAddSchema.safeParse({ tags: [] }).success, false);
});

test('serializePost renders dates as ISO strings and adds the public url', () => {
	const now = new Date('2026-07-01T12:00:00Z');
	const post: Post = {
		id: '00000000-0000-4000-8000-000000000000',
		slug: 'hello-world',
		title: 'Hello',
		description: 'A post.',
		bodyMarkdown: '# Hi',
		heroImage: null,
		tags: ['rust'],
		status: 'published',
		pubDate: now,
		updatedDate: null,
		readTimeMinutes: 1,
		authorId: null,
		createdAt: now,
		updatedAt: now,
	};

	const serialized = serializePost(post);
	assert.equal(serialized.pubDate, '2026-07-01T12:00:00.000Z');
	assert.equal(serialized.updatedDate, null);
	assert.equal(serialized.url, '/blog/hello-world/');
	assert.deepEqual(serialized.tags, ['rust']);
});
