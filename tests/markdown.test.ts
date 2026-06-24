import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateReadMinutes, renderMarkdown } from '../src/lib/markdown';

test('markdown output is sanitized', async () => {
	const html = await renderMarkdown(
		'# Safe\n\n<script>alert("no")</script>\n\n[link](javascript:alert(1))',
	);

	assert.match(html, /<h1>Safe<\/h1>/);
	assert.doesNotMatch(html, /<script/);
	assert.doesNotMatch(html, /href="javascript:/);
});

test('read time is at least one minute', () => {
	assert.equal(estimateReadMinutes('short post'), 1);
});
