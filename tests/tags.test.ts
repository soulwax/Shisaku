import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTagChanges, normalizeTags } from '../src/lib/tags';

test('normalizeTags splits strings, trims, and dedupes', () => {
	assert.deepEqual(normalizeTags('rust, gamedev , rust'), ['rust', 'gamedev']);
	assert.deepEqual(normalizeTags(['a', ' b ', '', 'a']), ['a', 'b']);
	assert.deepEqual(normalizeTags(undefined), []);
	assert.deepEqual(normalizeTags('+featured'), ['featured']);
});

test('applyTagChanges with tags replaces the whole list', () => {
	assert.deepEqual(applyTagChanges(['old', 'stale'], { tags: ['fresh', 'fresh', ' new '] }), [
		'fresh',
		'new',
	]);
	assert.deepEqual(applyTagChanges(['old'], { tags: [] }), []);
});

test('applyTagChanges tags wins over incremental fields', () => {
	assert.deepEqual(
		applyTagChanges(['old'], { tags: ['only'], addTags: ['ignored'], removeTags: ['only'] }),
		['only'],
	);
});

test('applyTagChanges appends addTags without duplicating', () => {
	assert.deepEqual(applyTagChanges(['rust'], { addTags: ['gamedev', 'rust'] }), [
		'rust',
		'gamedev',
	]);
	assert.deepEqual(applyTagChanges([], { addTags: ['first'] }), ['first']);
});

test('applyTagChanges removes tags case-insensitively', () => {
	assert.deepEqual(applyTagChanges(['Rust', 'gamedev'], { removeTags: ['rust'] }), ['gamedev']);
	assert.deepEqual(applyTagChanges(['a', 'b'], { removeTags: ['missing'] }), ['a', 'b']);
});

test('applyTagChanges combines add and remove in one call', () => {
	assert.deepEqual(applyTagChanges(['old', 'keep'], { addTags: ['new'], removeTags: ['old'] }), [
		'keep',
		'new',
	]);
});

test('applyTagChanges without changes normalizes the current list', () => {
	assert.deepEqual(applyTagChanges(['a', 'a', ' b '], {}), ['a', 'b']);
});
