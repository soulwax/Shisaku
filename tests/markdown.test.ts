import assert from 'node:assert/strict';
import test from 'node:test';
import {
	estimateReadMinutes,
	normalizeMarkdownEscapes,
	renderMarkdown,
} from '../src/lib/markdown';

test('markdown output is sanitized', async () => {
	const html = await renderMarkdown(
		'# Safe\n\n<script>alert("no")</script>\n\n[link](javascript:alert(1))',
	);

	assert.match(html, /<h1>Safe<\/h1>/);
	assert.doesNotMatch(html, /<script/);
	assert.doesNotMatch(html, /href="javascript:/);
});

test('renders fenced code in unsupported languages without throwing', async () => {
	// `zig` is intentionally not in the loaded grammar set; it must degrade, not 500.
	const html = await renderMarkdown('```zig\nconst x = 0;\n```\n');

	assert.match(html, /const x/);
});

test('highlights C and C++ fenced code blocks', async () => {
	const c = await renderMarkdown('```c\nint x = 0;\n```\n');
	const cpp = await renderMarkdown('```cpp\nauto y = 0;\n```\n');

	assert.match(c, /class="language-c"/);
	assert.match(cpp, /class="language-cpp"/);
});

test('read time is at least one minute', () => {
	assert.equal(estimateReadMinutes('short post'), 1);
});

test('strips stray backslash escapes from Markdown punctuation', () => {
	assert.equal(normalizeMarkdownEscapes('\\### Heading'), '### Heading');
	assert.equal(normalizeMarkdownEscapes('a \\`0.19.7\\` tag'), 'a `0.19.7` tag');
	assert.equal(normalizeMarkdownEscapes('list\\- item'), 'list- item');
	assert.equal(normalizeMarkdownEscapes('it \\*\\*works\\*\\*'), 'it **works**');
});

test('leaves backslashes inside real fenced code untouched', () => {
	const fenced = '```rust\nRegex::new(r"\\(").unwrap();\n```';
	assert.equal(normalizeMarkdownEscapes(fenced), fenced);
});

test('cleans escaped punctuation in prose and inline spans', () => {
	assert.equal(normalizeMarkdownEscapes('call `rem\\_euclid` here'), 'call `rem_euclid` here');
});

test('cleans code blocks whose fence was itself escaped', () => {
	const corrupted = '\\`\\`\\`glsl\nprecision highp float;\n\\`\\`\\`';
	assert.equal(
		normalizeMarkdownEscapes(corrupted),
		'```glsl\nprecision highp float;\n```',
	);
});
