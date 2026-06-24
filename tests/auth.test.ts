import assert from 'node:assert/strict';
import test from 'node:test';
import {
	isAllowedGitHubIdentity,
	isAuthorizedAdminUser,
	selectVerifiedGitHubEmail,
} from '../src/lib/auth/github';

test('only the soulwax GitHub account is authorized', () => {
	assert.equal(
		isAllowedGitHubIdentity(
			{ login: 'soulwax' },
			'soulwax@users.noreply.github.com',
		),
		true,
	);
	assert.equal(
		isAllowedGitHubIdentity(
			{ login: 'someone-else' },
			'soulwax@users.noreply.github.com',
		),
		false,
	);
});

test('GitHub email suffix is required', () => {
	assert.equal(isAllowedGitHubIdentity({ login: 'soulwax' }, 'soulwax@example.com'), false);
	assert.equal(isAllowedGitHubIdentity({ login: 'soulwax' }, null), false);
});

test('stored admin users are checked again before authorization', () => {
	assert.equal(
		isAuthorizedAdminUser({
			username: 'soulwax',
			email: 'soulwax@users.noreply.github.com',
			role: 'admin',
		}),
		true,
	);
	assert.equal(
		isAuthorizedAdminUser({
			username: 'soulwax',
			email: 'soulwax@example.com',
			role: 'admin',
		}),
		false,
	);
});

test('a verified GitHub noreply address is selected', () => {
	assert.equal(
		selectVerifiedGitHubEmail(
			[
				{
					email: 'soulwax@example.com',
					primary: true,
					verified: true,
					visibility: 'private',
				},
				{
					email: 'soulwax@users.noreply.github.com',
					primary: false,
					verified: true,
					visibility: null,
				},
			],
			null,
		),
		'soulwax@users.noreply.github.com',
	);
});
