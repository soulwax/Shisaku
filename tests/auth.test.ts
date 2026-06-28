import assert from 'node:assert/strict';
import test from 'node:test';
import {
	isAllowedGitHubIdentity,
	isAuthenticatedGitHubUser,
	isAuthorizedAdminUser,
	roleForGitHubLogin,
	selectVerifiedGitHubEmail,
} from '../src/lib/auth/github';

test('any non-empty GitHub login can authenticate', () => {
	assert.equal(isAllowedGitHubIdentity({ login: 'soulwax' }), true);
	assert.equal(isAllowedGitHubIdentity({ login: 'someone-else' }), true);
	assert.equal(isAllowedGitHubIdentity({ login: '' }), false);
});

const ADMIN = 'configured-admin';

test('the configured admin handle is assigned admin and other users become commenters', () => {
	assert.equal(roleForGitHubLogin('configured-admin', ADMIN), 'admin');
	assert.equal(roleForGitHubLogin('Configured-Admin', ADMIN), 'admin');
	assert.equal(roleForGitHubLogin('someone-else', ADMIN), 'commenter');
});

test('nobody is admin when no admin handle is configured', () => {
	assert.equal(roleForGitHubLogin('configured-admin', ''), 'commenter');
	assert.equal(
		isAuthorizedAdminUser(
			{ username: 'configured-admin', email: 'admin@example.com', role: 'admin' },
			'',
		),
		false,
	);
});

test('only the configured admin handle can access admin authoring', () => {
	assert.equal(
		isAuthorizedAdminUser(
			{
				username: 'configured-admin',
				email: 'admin@example.com',
				role: 'admin',
			},
			ADMIN,
		),
		true,
	);
	assert.equal(
		isAuthorizedAdminUser(
			{
				username: 'someone-else',
				email: 'someone@example.com',
				role: 'admin',
			},
			ADMIN,
		),
		false,
	);
	assert.equal(
		isAuthorizedAdminUser(
			{
				username: 'configured-admin',
				email: 'admin@example.com',
				role: 'commenter',
			},
			ADMIN,
		),
		false,
	);
});

test('admin and commenter roles are valid signed-in GitHub users', () => {
	assert.equal(
		isAuthenticatedGitHubUser({
			username: 'soulwax',
			email: 'soulwax@example.com',
			role: 'admin',
		}),
		true,
	);
	assert.equal(
		isAuthenticatedGitHubUser({
			username: 'someone-else',
			email: 'someone@example.com',
			role: 'commenter',
		}),
		true,
	);
	assert.equal(
		isAuthenticatedGitHubUser({
			username: 'someone-else',
			email: 'someone@example.com',
			role: 'editor',
		}),
		false,
	);
});

test('the primary verified GitHub email is selected', () => {
	assert.equal(
		selectVerifiedGitHubEmail(
			[
				{
					email: 'secondary@example.com',
					primary: false,
					verified: true,
					visibility: null,
				},
				{
					email: 'soulwax@example.com',
					primary: true,
					verified: true,
					visibility: 'private',
				},
			],
			null,
		),
		'soulwax@example.com',
	);
});

test('profile email is used when no verified email is returned', () => {
	assert.equal(selectVerifiedGitHubEmail([], 'soulwax@example.com'), 'soulwax@example.com');
});
