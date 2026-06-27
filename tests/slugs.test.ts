import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSlug } from '../src/lib/slugs';

test('normalizes markdown-style post titles into stable slugs', () => {
	assert.equal(
		normalizeSlug('## Devlog 7 – P0 Is Done, But Not Yet Safe'),
		'devlog-7-p0-is-done-but-not-yet-safe',
	);
});

test('guards generated slugs against special characters', () => {
	assert.equal(normalizeSlug('C++ & Rust @ 60%: déjà vu!'), 'c-plus-plus-and-rust-at-60-percent-deja-vu');
	assert.equal(normalizeSlug("Don't ship --- unsafe URLs"), 'dont-ship-unsafe-urls');
	assert.equal(normalizeSlug('Æther, Straße, Smørrebrød'), 'aether-strasse-smorrebrod');
});
